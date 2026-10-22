-- FASE 24 (cont.): reajuste no meio do período.
-- Na fatura real a Autopista Litoral Sul cobrou 5,70/eixo até 13/09 e
-- 5,90/eixo a partir de 14/09 — uma sugestão só para o mês explicava 58% dos
-- débitos (e aprovada geraria divergência falsa na outra metade). A geração
-- passa a testar um ponto de corte por praça: se dividir o período em dois
-- explica pelo menos 5% a mais dos débitos (mínimo 5), saem duas sugestões,
-- cada uma com o seu período.

drop index pedagio.tarifa_eixo_sugestao_uma_pendente_por_praca;
create unique index tarifa_eixo_sugestao_uma_pendente_por_praca_periodo
  on pedagio.tarifa_eixo_sugestao (praca_id, periodo_inicio) where status = 'pendente';

create or replace function pedagio.gerar_sugestoes_tarifa(p_inicio date, p_fim date)
returns int
language plpgsql
set search_path to ''
as $$
declare
  v_qtd int;
begin
  if not pedagio.eh_admin() then
    raise exception 'apenas administradores podem gerar sugestões de tarifa';
  end if;
  if p_fim < p_inicio then
    raise exception 'fim do período antes do início';
  end if;

  delete from pedagio.tarifa_eixo_sugestao where status = 'pendente';

  -- Em etapas com tabelas temporárias + ANALYZE: numa CTE só, o planner
  -- estimava ~78 linhas para os ~12 mil débitos agrupados (filtro pelo dia
  -- local) e escolhia laços aninhados em toda a cadeia — passava de minutos.
  drop table if exists pg_temp._sug_base, pg_temp._sug_expl;

  create temp table pg_temp._sug_base on commit drop as
    select p.praca_id, (p.data_hora at time zone 'America/Sao_Paulo')::date as dia,
      p.valor_cobrado as v, cv.quantidade_eixos as e, count(*)::int as n
    from pedagio.passagem_pedagio p
    join pedagio.validacao_passagem vp on vp.passagem_id = p.id
    join pedagio.categoria_veiculo cv on cv.id = vp.categoria_veiculo_id
    where p.tipo_uso = 'passagem'
      and p.condicao = 'debito'
      and p.valor_cobrado > 0
      and p.praca_id is not null
      and (p.data_hora at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim
      and not exists (
        select 1 from pedagio.tarifa_praca tp
        where tp.praca_id = p.praca_id
          and daterange(tp.vigencia_inicio, coalesce(tp.vigencia_fim, 'infinity'::date), '[]')
              && daterange(p_inicio, p_fim, '[]')
      )
    group by 1, 2, 3, 4;
  analyze pg_temp._sug_base;

  create temp table pg_temp._sug_expl on commit drop as
  with base as (
    select * from pg_temp._sug_base
  ),
  cand as (
    select distinct praca_id, round(v / e, 2) as t from base
    union
    select distinct praca_id, round(v / (e * 0.95), 2) from base
  ),
  vals as (
    select praca_id, v, e, sum(n)::int as n from base group by praca_id, v, e
  ),
  -- eixos cobrados por candidato × valor distinto. Mesma regra de
  -- pedagio.eixos_cobrados, escrita em linha: a função tem search_path fixo
  -- e não é embutida pelo planner.
  kmap as (
    select c.praca_id, c.t, vl.v, vl.e, vl.n, x.k, x.tag
    from cand c
    join vals vl on vl.praca_id = c.praca_id
    cross join lateral (
      select
        case
          when q.cheio between 1 and 12
            and abs(vl.v - round(c.t * q.cheio, 2)) <= 0.02 then q.cheio
          when q.tag between 1 and 12
            and least(abs(vl.v - round(c.t * q.tag * 0.95, 2)),
                      abs(vl.v - round(round(c.t * 0.95, 2) * q.tag, 2))) <= 0.02 then q.tag
        end as k,
        not (q.cheio between 1 and 12 and abs(vl.v - round(c.t * q.cheio, 2)) <= 0.02) as tag
      from (select round(vl.v / c.t)::int as cheio, round(vl.v / (c.t * 0.95))::int as tag) q
    ) x
    where c.t > 0
  ),
  -- só os 8 candidatos que mais explicam no período inteiro seguem para a
  -- busca do corte dia a dia (num reajuste as duas tarifas, e as leituras
  -- cheio/TAG de cada uma, ficam entre eles)
  top as (
    select praca_id, t
    from (
      select praca_id, t,
        row_number() over (partition by praca_id order by sum(n) filter (where k <= e) desc nulls last, t desc) as rn
      from kmap
      group by praca_id, t
    ) s
    where rn <= 8
  ),
  -- explicados por candidato e dia (todo dia com débito da praça aparece,
  -- com 0 quando o candidato não explica nada)
  expl as (
    select b.praca_id, km.t, b.dia,
      coalesce(sum(b.n) filter (where km.k is not null and km.k <= b.e), 0)::int as ex,
      coalesce(sum(b.n) filter (where km.k = b.e), 0)::int as co,
      coalesce(sum(b.n) filter (where km.k is not null and km.k <= b.e and not km.tag), 0)::int as cheio
    from base b
    join kmap km on km.praca_id = b.praca_id and km.v = b.v and km.e = b.e
    join top tp on tp.praca_id = km.praca_id and tp.t = km.t
    group by b.praca_id, km.t, b.dia
  )
  select * from expl;
  analyze pg_temp._sug_expl;

  with expl as (
    select * from pg_temp._sug_expl
  ),
  dias as (
    select praca_id, dia, sum(n)::int as n from pg_temp._sug_base group by praca_id, dia
  ),
  acum as (
    select e.praca_id, e.t, e.dia,
      sum(e.ex) over (partition by e.praca_id, e.t order by e.dia) as ex_ate,
      sum(e.ex) over (partition by e.praca_id, e.t) as ex_tot
    from expl e
  ),
  unico as (
    select praca_id, max(ex_tot) as ex from acum group by praca_id
  ),
  totais as (
    select praca_id, sum(n)::int as total, min(dia) as d0, max(dia) as d1
    from dias group by praca_id
  ),
  -- corte no fim do dia d: melhor candidato antes + melhor depois
  corte as (
    select a.praca_id, a.dia, max(a.ex_ate) + max(a.ex_tot - a.ex_ate) as ex
    from acum a
    join totais tt on tt.praca_id = a.praca_id
    where a.dia < tt.d1
    group by a.praca_id, a.dia
  ),
  melhor_corte as (
    select distinct on (praca_id) praca_id, dia, ex
    from corte
    order by praca_id, ex desc, dia
  ),
  seg as materialized (
    select tt.praca_id, tt.d0 as ini,
      case when mc.ex - u.ex >= greatest(5, 0.05 * tt.total) then mc.dia else tt.d1 end as fim
    from totais tt
    join unico u on u.praca_id = tt.praca_id
    left join melhor_corte mc on mc.praca_id = tt.praca_id
    union all
    select tt.praca_id,
      (select min(d.dia) from dias d where d.praca_id = tt.praca_id and d.dia > mc.dia),
      tt.d1
    from totais tt
    join unico u on u.praca_id = tt.praca_id
    join melhor_corte mc on mc.praca_id = tt.praca_id
    where mc.ex - u.ex >= greatest(5, 0.05 * tt.total)
  ),
  seg_c as (
    select s.praca_id, s.ini, s.fim, e.t,
      sum(e.ex)::int as ex, sum(e.co)::int as co, sum(e.cheio)::int as cheio,
      coalesce(abs(o.valor_eixo - e.t) <= 0.01, false) as osm
    from seg s
    join expl e on e.praca_id = s.praca_id and e.dia between s.ini and s.fim
    left join pedagio.tarifa_eixo_osm o on o.praca_id = s.praca_id
    group by s.praca_id, s.ini, s.fim, e.t, o.valor_eixo
  ),
  seg_max as (
    select praca_id, ini, max(ex) as mx from seg_c group by praca_id, ini
  ),
  -- valor cheio e valor com TAG explicam os mesmos débitos (5,70 cheio =
  -- 6,00 − 5%). Praça em que o valor do OSM explica um trecho principalmente
  -- com TAG cobra com TAG (lotes do PR na fatura real); senão vale a leitura
  -- pelo valor cheio (Litoral Sul: 5,70 e depois 5,90 = OSM, cheio).
  pref_tag as (
    select distinct c.praca_id
    from seg_c c
    join seg_max m on m.praca_id = c.praca_id and m.ini = c.ini
    where c.osm and c.ex = m.mx and c.cheio * 2 < c.ex
  ),
  -- melhor candidato de cada trecho; empate -> mais cobranças completas,
  -- depois o que bate com o OSM, depois a leitura cheio/TAG da praça,
  -- depois o maior valor
  seg_t as (
    select distinct on (c.praca_id, c.ini)
      c.praca_id, c.ini, c.fim, c.t, c.ex as explicadas
    from seg_c c
    left join pref_tag p on p.praca_id = c.praca_id
    order by c.praca_id, c.ini, c.ex desc, c.co desc, c.osm desc,
      case when p.praca_id is null then c.cheio else -c.cheio end desc, c.t desc
  )
  insert into pedagio.tarifa_eixo_sugestao (
    praca_id, periodo_inicio, periodo_fim, valor_eixo_fatura, passagens_total, passagens_explicadas,
    valor_eixo_osm, osm_conferido_em, fontes_concordam
  )
  select st.praca_id, st.ini, st.fim, st.t,
    (select sum(d.n)::int from dias d where d.praca_id = st.praca_id and d.dia between st.ini and st.fim),
    st.explicadas,
    o.valor_eixo, o.osm_conferido_em, coalesce(abs(o.valor_eixo - st.t) <= 0.01, false)
  from seg_t st
  left join pedagio.tarifa_eixo_osm o on o.praca_id = st.praca_id;

  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$$;

-- aprovar: com dois trechos por praça, a ordem de aprovação não pode
-- importar — a tarifa nova termina na véspera de uma tarifa posterior já
-- gravada, além de fechar a anterior aberta.
create or replace function pedagio.aprovar_sugestoes_tarifa(p_ids uuid[], p_fonte text default 'fatura')
returns int
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_sug pedagio.tarifa_eixo_sugestao;
  v_valor numeric(10,2);
  v_fim date;
  v_tarifa_id uuid;
  v_qtd int := 0;
begin
  if not pedagio.eh_admin() then
    raise exception 'apenas administradores podem aprovar sugestões de tarifa';
  end if;
  if p_fonte not in ('fatura', 'osm') then
    raise exception 'fonte inválida: %', p_fonte;
  end if;

  for v_sug in
    select * from pedagio.tarifa_eixo_sugestao
    where id = any(p_ids) and status = 'pendente'
    order by praca_id, periodo_inicio
  loop
    v_valor := case when p_fonte = 'osm' then v_sug.valor_eixo_osm else v_sug.valor_eixo_fatura end;
    if v_valor is null then
      continue;
    end if;

    update pedagio.tarifa_praca
    set vigencia_fim = v_sug.periodo_inicio - 1
    where praca_id = v_sug.praca_id
      and vigencia_inicio < v_sug.periodo_inicio
      and (vigencia_fim is null or vigencia_fim >= v_sug.periodo_inicio);

    select min(vigencia_inicio) - 1 into v_fim
    from pedagio.tarifa_praca
    where praca_id = v_sug.praca_id and vigencia_inicio > v_sug.periodo_inicio;

    insert into pedagio.tarifa_praca (praca_id, valor_eixo, vigencia_inicio, vigencia_fim, origem)
    values (v_sug.praca_id, v_valor, v_sug.periodo_inicio, v_fim, 'sugestao')
    returning id into v_tarifa_id;

    update pedagio.tarifa_eixo_sugestao
    set status = 'aprovada',
        tarifa_praca_id = v_tarifa_id,
        decidido_por = coalesce((select auth.jwt()) ->> 'email', current_user),
        decidido_em = now()
    where id = v_sug.id;

    v_qtd := v_qtd + 1;
  end loop;

  return v_qtd;
end;
$$;

revoke execute on function pedagio.aprovar_sugestoes_tarifa(uuid[], text) from public, anon;
