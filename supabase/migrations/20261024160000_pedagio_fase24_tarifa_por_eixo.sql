-- FASE 24: tarifa por eixo.
-- A fatura real (set/2026) mostrou que a cobrança é tarifa por eixo × eixos
-- cobrados — com eixos suspensos (caminhão vazio paga menos eixos) e desconto
-- de 5% de TAG em parte das praças. Tarifa fixa por categoria deixaria ~30%
-- das passagens como divergência falsa. tarifa_praca passa a guardar o valor
-- por eixo (por praça, com vigência); a validação acha quantos eixos o valor
-- cobrado representa.

-- 1) tarifa_praca: valor por categoria -> valor por eixo
alter table pedagio.tarifa_praca disable trigger tarifa_praca_revalidar_passagens;

alter table pedagio.tarifa_praca add column valor_eixo numeric(10,2);

update pedagio.tarifa_praca tp
set valor_eixo = round(tp.valor / cv.quantidade_eixos, 2)
from pedagio.categoria_veiculo cv
where cv.id = tp.categoria_veiculo_id;

-- uma tarifa por praça/período: fica a da categoria com menos eixos (decisão
-- do usuário para Franco da Rocha: 65/80/120 -> a de 6 eixos, 10,83/eixo)
delete from pedagio.tarifa_praca tp
using pedagio.categoria_veiculo cv
where cv.id = tp.categoria_veiculo_id
  and exists (
    select 1
    from pedagio.tarifa_praca o
    join pedagio.categoria_veiculo ocv on ocv.id = o.categoria_veiculo_id
    where o.praca_id = tp.praca_id
      and o.id <> tp.id
      and daterange(o.vigencia_inicio, coalesce(o.vigencia_fim, 'infinity'::date), '[]')
          && daterange(tp.vigencia_inicio, coalesce(tp.vigencia_fim, 'infinity'::date), '[]')
      and (ocv.quantidade_eixos, o.id::text) < (cv.quantidade_eixos, tp.id::text)
  );

alter table pedagio.tarifa_praca drop constraint tarifa_praca_sem_sobreposicao;
drop index pedagio.tarifa_praca_praca_categoria_idx;
alter table pedagio.tarifa_praca drop column categoria_veiculo_id;
alter table pedagio.tarifa_praca drop column valor;

alter table pedagio.tarifa_praca alter column valor_eixo set not null;
alter table pedagio.tarifa_praca add constraint tarifa_praca_valor_eixo_check check (valor_eixo > 0);
alter table pedagio.tarifa_praca add column origem text not null default 'manual'
  check (origem in ('manual', 'sugestao'));
alter table pedagio.tarifa_praca add constraint tarifa_praca_sem_sobreposicao exclude using gist (
  praca_id with =,
  daterange(vigencia_inicio, coalesce(vigencia_fim, 'infinity'::date), '[]') with &&
);
create index tarifa_praca_praca_id_idx on pedagio.tarifa_praca (praca_id);

alter table pedagio.tarifa_praca enable trigger tarifa_praca_revalidar_passagens;

-- 2) quantos eixos o valor cobrado representa. Aceita o valor cheio e o valor
-- com 5% de desconto de TAG (decisão do usuário: sem cadastro de desconto por
-- praça), arredondando o desconto no total ou por eixo (as duas formas
-- aparecem na fatura real). Tolerância de 2 centavos. Nulo = nenhum número
-- inteiro de eixos (1 a 12) explica o valor.
create or replace function pedagio.eixos_cobrados(
  p_valor numeric,
  p_tarifa_eixo numeric,
  out eixos int,
  out com_desconto boolean
)
language sql
immutable
set search_path to ''
as $$
  with k as (
    select
      round(p_valor / p_tarifa_eixo)::int as cheio,
      round(p_valor / (p_tarifa_eixo * 0.95))::int as tag
  )
  select
    case
      when k.cheio between 1 and 12
        and abs(p_valor - round(p_tarifa_eixo * k.cheio, 2)) <= 0.02 then k.cheio
      when k.tag between 1 and 12
        and least(abs(p_valor - round(p_tarifa_eixo * k.tag * 0.95, 2)),
                  abs(p_valor - round(round(p_tarifa_eixo * 0.95, 2) * k.tag, 2))) <= 0.02 then k.tag
    end,
    case
      when k.cheio between 1 and 12
        and abs(p_valor - round(p_tarifa_eixo * k.cheio, 2)) <= 0.02 then false
      when k.tag between 1 and 12
        and least(abs(p_valor - round(p_tarifa_eixo * k.tag * 0.95, 2)),
                  abs(p_valor - round(round(p_tarifa_eixo * 0.95, 2) * k.tag, 2))) <= 0.02 then true
    end
  from k
  where p_tarifa_eixo > 0 and p_valor > 0
$$;

-- 3) validacao_passagem: detalhe da conferência por eixo
alter table pedagio.validacao_passagem
  add column eixos_composicao int,
  add column eixos_cobrados int,
  add column desconto_tag boolean,
  add column motivo_valor text
    check (motivo_valor in ('completo', 'eixos_suspensos', 'eixos_a_maior', 'nao_multiplo'));

-- 4) validar_passagem: gerada a partir da definição ativa, só o bloco de
-- tarifa muda. Só débito é conferido contra a tarifa — crédito com praça é o
-- vale-pedágio do embarcador (confrontado com o débito na FASE 18).
create or replace function pedagio.validar_passagem(p_passagem_id uuid)
 returns pedagio.validacao_passagem
 language plpgsql
 set search_path to ''
as $function$
declare
  v_passagem pedagio.passagem_pedagio;
  v_janela interval := pedagio.janela_tolerancia_validacao();
  v_posicao pedagio.posicao_veiculo;
  v_tarifa numeric(10,2);
  v_resultado text;
  v_dentro boolean;
  v_distancia numeric;
  v_diferenca int;
  v_divergencia numeric;
  v_validacao pedagio.validacao_passagem;
  v_categoria_id uuid;
  v_origem_categoria text;
  v_viagem_transporte_id uuid;
  v_vinculo_viagem_status text;
  v_viagem_transporte_candidatas int;
  v_numero_viagem_bate boolean;
  v_tarifa_eixo numeric(10,2);
  v_eixos_composicao int;
  v_eixos_cobrados int;
  v_desconto_tag boolean;
  v_motivo_valor text;
begin
  select * into v_passagem from pedagio.passagem_pedagio where id = p_passagem_id;
  if not found then
    raise exception 'passagem % nao encontrada', p_passagem_id;
  end if;

  -- FASE 23: crédito de vale-pedágio sem Descrição (sem praça) não é cobrança
  -- de praça — não se valida GPS/tarifa, também em revalidações posteriores
  if v_passagem.condicao = 'credito' and v_passagem.praca_id is null
    and coalesce(trim(v_passagem.praca_informada), '') = '' then
    update pedagio.passagem_pedagio set status_validacao = 'nao_aplicavel' where id = p_passagem_id;
    return null;
  end if;

  -- FASE 22: praça criada automaticamente pela importação ainda sem polígono
  -- também é sem_cadastro (não dá pra validar local nem tarifa ainda)
  if v_passagem.veiculo_id is null or v_passagem.praca_id is null
    or not exists (select 1 from pedagio.praca_pedagio pp where pp.id = v_passagem.praca_id and pp.poligono is not null) then
    update pedagio.passagem_pedagio set status_validacao = 'sem_cadastro' where id = p_passagem_id;
    return null;
  end if;

  select pv.* into v_posicao
  from pedagio.posicao_veiculo pv
  join pedagio.praca_pedagio pp on pp.id = v_passagem.praca_id
  where pv.veiculo_id = v_passagem.veiculo_id
    and pv.data_hora between v_passagem.data_hora - v_janela and v_passagem.data_hora + v_janela
    and extensions.ST_Contains(pp.poligono, pv.geom)
  order by abs(extract(epoch from pv.data_hora - v_passagem.data_hora))
  limit 1;

  if found then
    v_dentro := true;
    v_diferenca := extract(epoch from (v_posicao.data_hora - v_passagem.data_hora))::int;
    v_distancia := 0;
  else
    select pv.* into v_posicao
    from pedagio.posicao_veiculo pv
    where pv.veiculo_id = v_passagem.veiculo_id
      and pv.data_hora between v_passagem.data_hora - v_janela and v_passagem.data_hora + v_janela
    order by abs(extract(epoch from pv.data_hora - v_passagem.data_hora))
    limit 1;

    if found then
      v_dentro := false;
      v_diferenca := extract(epoch from (v_posicao.data_hora - v_passagem.data_hora))::int;
      select extensions.ST_Distance(pp.poligono::extensions.geography, v_posicao.geom::extensions.geography)
      into v_distancia
      from pedagio.praca_pedagio pp where pp.id = v_passagem.praca_id;
    else
      v_dentro := null;
      v_diferenca := null;
      v_distancia := null;
    end if;
  end if;

  v_categoria_id := pedagio.categoria_por_composicao(v_passagem.placa_informada, v_passagem.data_hora);
  if v_categoria_id is not null then
    v_origem_categoria := 'composicao_viagem';
  else
    select categoria_fallback_id into v_categoria_id from pedagio.veiculo where id = v_passagem.veiculo_id;
    v_origem_categoria := 'cadastro_veiculo';
  end if;

  -- FASE 24: tarifa por eixo. Eixos cobrados <= eixos da composição é
  -- cobrança correta (igual = completo, menor = eixos suspensos); mais eixos
  -- que a composição ou valor que não é múltiplo da tarifa é divergência,
  -- contra a tarifa cheia da composição (com desconto, se o valor veio com).
  select cv.quantidade_eixos into v_eixos_composicao
  from pedagio.categoria_veiculo cv where cv.id = v_categoria_id;

  if v_passagem.condicao = 'debito' then
    select tp.valor_eixo into v_tarifa_eixo
    from pedagio.tarifa_praca tp
    where tp.praca_id = v_passagem.praca_id
      and tp.vigencia_inicio <= (v_passagem.data_hora at time zone 'America/Sao_Paulo')::date
      and (tp.vigencia_fim is null or tp.vigencia_fim >= (v_passagem.data_hora at time zone 'America/Sao_Paulo')::date);
  end if;

  if v_tarifa_eixo is not null and v_eixos_composicao is not null then
    select ec.eixos, ec.com_desconto into v_eixos_cobrados, v_desconto_tag
    from pedagio.eixos_cobrados(v_passagem.valor_cobrado, v_tarifa_eixo) ec;

    if v_eixos_cobrados is null then
      v_motivo_valor := 'nao_multiplo';
      v_tarifa := round(v_tarifa_eixo * v_eixos_composicao, 2);
    elsif v_eixos_cobrados > v_eixos_composicao then
      v_motivo_valor := 'eixos_a_maior';
      v_tarifa := round(v_tarifa_eixo * v_eixos_composicao * case when v_desconto_tag then 0.95 else 1 end, 2);
    else
      v_motivo_valor := case when v_eixos_cobrados = v_eixos_composicao then 'completo' else 'eixos_suspensos' end;
      v_tarifa := v_passagem.valor_cobrado;
    end if;
    v_divergencia := v_passagem.valor_cobrado - v_tarifa;
  else
    v_tarifa := null;
    v_divergencia := null;
  end if;

  -- vínculo com viagem_transporte: placa + janela saída/chegada (mesma
  -- heurística da FASE 13/19). Mais de uma candidata -> ambíguo, não
  -- resolve sozinho.
  select count(*) into v_viagem_transporte_candidatas
  from pedagio.viagem_transporte vt
  where upper(trim(vt.placa_informada)) = upper(trim(v_passagem.placa_informada))
    and v_passagem.data_hora between vt.data_hora_saida and vt.data_hora_chegada;

  if v_viagem_transporte_candidatas = 0 then
    v_viagem_transporte_id := null;
    v_vinculo_viagem_status := 'sem_vinculo';
  elsif v_viagem_transporte_candidatas = 1 then
    select vt.id into v_viagem_transporte_id
    from pedagio.viagem_transporte vt
    where upper(trim(vt.placa_informada)) = upper(trim(v_passagem.placa_informada))
      and v_passagem.data_hora between vt.data_hora_saida and vt.data_hora_chegada;
    v_vinculo_viagem_status := 'vinculado';
  else
    v_viagem_transporte_id := null;
    v_vinculo_viagem_status := 'ambiguo';
  end if;

  if v_vinculo_viagem_status = 'vinculado'
    and v_passagem.viagem_informada is not null and trim(v_passagem.viagem_informada) <> '' then
    select upper(trim(vt.numero_transporte)) = upper(trim(v_passagem.viagem_informada))
    into v_numero_viagem_bate
    from pedagio.viagem_transporte vt
    where vt.id = v_viagem_transporte_id;
  else
    v_numero_viagem_bate := null;
  end if;

  if v_posicao.id is null then
    v_resultado := 'sem_dados_gps';
  elsif v_dentro and (v_divergencia is null or v_divergencia = 0) then
    v_resultado := 'ok';
  elsif v_dentro then
    v_resultado := 'valor_divergente';
  elsif v_divergencia is null or v_divergencia = 0 then
    v_resultado := 'fora_poligono';
  else
    v_resultado := 'local_e_valor_divergentes';
  end if;

  insert into pedagio.validacao_passagem (
    passagem_id, posicao_veiculo_id, dentro_poligono, distancia_metros,
    diferenca_segundos, valor_esperado, divergencia_valor, resultado, validado_em,
    categoria_veiculo_id, origem_categoria,
    viagem_transporte_id, vinculo_viagem_status, viagem_transporte_candidatas, numero_viagem_bate,
    eixos_composicao, eixos_cobrados, desconto_tag, motivo_valor
  ) values (
    p_passagem_id, v_posicao.id, v_dentro, v_distancia,
    v_diferenca, v_tarifa, v_divergencia, v_resultado, now(),
    v_categoria_id, v_origem_categoria,
    v_viagem_transporte_id, v_vinculo_viagem_status, v_viagem_transporte_candidatas, v_numero_viagem_bate,
    case when v_motivo_valor is not null then v_eixos_composicao end, v_eixos_cobrados, v_desconto_tag, v_motivo_valor
  )
  on conflict (passagem_id) do update set
    posicao_veiculo_id = excluded.posicao_veiculo_id,
    dentro_poligono = excluded.dentro_poligono,
    distancia_metros = excluded.distancia_metros,
    diferenca_segundos = excluded.diferenca_segundos,
    valor_esperado = excluded.valor_esperado,
    divergencia_valor = excluded.divergencia_valor,
    resultado = excluded.resultado,
    validado_em = now(),
    categoria_veiculo_id = excluded.categoria_veiculo_id,
    origem_categoria = excluded.origem_categoria,
    viagem_transporte_id = excluded.viagem_transporte_id,
    vinculo_viagem_status = excluded.vinculo_viagem_status,
    viagem_transporte_candidatas = excluded.viagem_transporte_candidatas,
    numero_viagem_bate = excluded.numero_viagem_bate,
    eixos_composicao = excluded.eixos_composicao,
    eixos_cobrados = excluded.eixos_cobrados,
    desconto_tag = excluded.desconto_tag,
    motivo_valor = excluded.motivo_valor
  returning * into v_validacao;

  update pedagio.passagem_pedagio set status_validacao = v_resultado where id = p_passagem_id;

  return v_validacao;
end;
$function$;

-- 5) vw_passagens_detalhado: colunas novas no final (restrição do
-- CREATE OR REPLACE VIEW)
create or replace view pedagio.vw_passagens_detalhado
with (security_invoker = true)
as
 select pp.id as passagem_id,
    pp.data_hora,
    pp.veiculo_id,
    v.placa,
    pp.praca_id,
    pc.nome as praca_nome,
    pc.rodovia,
    pp.valor_cobrado,
    coalesce(vp.valor_esperado, ve.valor_esperado) as valor_esperado,
    coalesce(vp.divergencia_valor, ve.divergencia_valor) as divergencia_valor,
    pp.status_validacao,
    vp.dentro_poligono,
    vp.distancia_metros,
    vp.diferenca_segundos,
    pp.lote_importacao_id,
    pp.numero_fatura,
    pp.tipo_veiculo_informado,
    pp.sentido_informado,
    pp.tipo_uso,
    pp.condicao,
    pp.viagem_informada as viagem,
    pp.embarcador_informada as embarcador,
    pp.viagem_id,
    pp.embarcador_id,
    vp.posicao_veiculo_id,
    vp.categoria_veiculo_id,
    vp.origem_categoria,
    cv.codigo as categoria_codigo,
    cv.descricao as categoria_descricao,
    pp.estacionamento_id,
    est.nome as estacionamento_nome,
    ve.entrada_detectada,
    ve.saida_detectada,
    ve.diarias_detectadas,
    vp.viagem_transporte_id,
    vt.numero_transporte as viagem_transporte_numero,
    vp.vinculo_viagem_status,
    vp.viagem_transporte_candidatas,
    vp.numero_viagem_bate,
    v.frota,
    vp.eixos_composicao,
    vp.eixos_cobrados,
    vp.desconto_tag,
    vp.motivo_valor
   from pedagio.passagem_pedagio pp
     left join pedagio.veiculo v on v.id = pp.veiculo_id
     left join pedagio.praca_pedagio pc on pc.id = pp.praca_id
     left join pedagio.validacao_passagem vp on vp.passagem_id = pp.id
     left join pedagio.categoria_veiculo cv on cv.id = vp.categoria_veiculo_id
     left join pedagio.validacao_estacionamento ve on ve.passagem_id = pp.id
     left join pedagio.estacionamento est on est.id = pp.estacionamento_id
     left join pedagio.viagem_transporte vt on vt.id = vp.viagem_transporte_id;

-- 6) divergência por motivo (Painel): só débitos de passagem, que são os
-- conferidos contra a tarifa; sem tarifa vigente = 'sem_tarifa'
create view pedagio.vw_divergencia_por_motivo
with (security_invoker = true)
as
select
  coalesce(motivo_valor, 'sem_tarifa') as motivo_valor,
  count(*) as qtd_passagens,
  sum(valor_cobrado) as total_cobrado,
  sum(valor_esperado) as total_esperado,
  sum(coalesce(divergencia_valor, 0)) as divergencia_valor
from pedagio.vw_passagens_detalhado
where tipo_uso = 'passagem' and condicao = 'debito'
group by coalesce(motivo_valor, 'sem_tarifa');

-- 7) sugestões de tarifa
-- instantâneo da tarifa por eixo do OpenStreetMap por praça (carregado por
-- script, sem chamada externa em tempo de execução; licença ODbL)
create table pedagio.tarifa_eixo_osm (
  praca_id uuid primary key references pedagio.praca_pedagio(id) on delete cascade,
  valor_eixo numeric(10,2) not null check (valor_eixo > 0),
  osm_conferido_em date,
  osm_ids text[] not null default '{}',
  carregado_em timestamptz not null default now()
);

alter table pedagio.tarifa_eixo_osm enable row level security;

create table pedagio.tarifa_eixo_sugestao (
  id uuid primary key default gen_random_uuid(),
  praca_id uuid not null references pedagio.praca_pedagio(id) on delete cascade,
  periodo_inicio date not null,
  periodo_fim date not null,
  valor_eixo_fatura numeric(10,2) not null check (valor_eixo_fatura > 0),
  passagens_total int not null,
  passagens_explicadas int not null,
  valor_eixo_osm numeric(10,2),
  osm_conferido_em date,
  fontes_concordam boolean not null default false,
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'descartada')),
  decidido_por text,
  decidido_em timestamptz,
  tarifa_praca_id uuid references pedagio.tarifa_praca(id) on delete set null,
  created_at timestamptz not null default now()
);

create index tarifa_eixo_sugestao_praca_id_idx on pedagio.tarifa_eixo_sugestao (praca_id);
create index tarifa_eixo_sugestao_tarifa_praca_id_idx on pedagio.tarifa_eixo_sugestao (tarifa_praca_id);
create unique index tarifa_eixo_sugestao_uma_pendente_por_praca
  on pedagio.tarifa_eixo_sugestao (praca_id) where status = 'pendente';

alter table pedagio.tarifa_eixo_sugestao enable row level security;

create policy leitura_autorizados on pedagio.tarifa_eixo_osm for select using ((select pedagio.usuario_autorizado()));
create policy insercao_admin on pedagio.tarifa_eixo_osm for insert with check ((select pedagio.eh_admin()));
create policy atualizacao_admin on pedagio.tarifa_eixo_osm for update using ((select pedagio.eh_admin())) with check ((select pedagio.eh_admin()));
create policy exclusao_admin on pedagio.tarifa_eixo_osm for delete using ((select pedagio.eh_admin()));

create policy leitura_autorizados on pedagio.tarifa_eixo_sugestao for select using ((select pedagio.usuario_autorizado()));
create policy insercao_admin on pedagio.tarifa_eixo_sugestao for insert with check ((select pedagio.eh_admin()));
create policy atualizacao_admin on pedagio.tarifa_eixo_sugestao for update using ((select pedagio.eh_admin())) with check ((select pedagio.eh_admin()));
create policy exclusao_admin on pedagio.tarifa_eixo_sugestao for delete using ((select pedagio.eh_admin()));

-- valor por eixo sugerido pelas faturas do período: entre os candidatos
-- (valor/eixos da composição, cheio ou com desconto de TAG), o que explica
-- mais débitos com eixos cobrados <= eixos da composição; empate -> mais
-- cobranças completas, depois o que bate com o OSM, depois o maior valor.
-- Só praças sem tarifa vigente em todo o período e com passagens já
-- validadas (categoria conhecida). Refaz as sugestões pendentes.
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

  with base as (
    select p.praca_id, p.valor_cobrado as v, cv.quantidade_eixos as e, count(*)::int as n,
      min((p.data_hora at time zone 'America/Sao_Paulo')::date) as d0,
      max((p.data_hora at time zone 'America/Sao_Paulo')::date) as d1
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
    group by p.praca_id, p.valor_cobrado, cv.quantidade_eixos
  ),
  cand as (
    select distinct praca_id, round(v / e, 2) as t from base
    union
    select distinct praca_id, round(v / (e * 0.95), 2) from base
  ),
  -- mesma regra de pedagio.eixos_cobrados, escrita em linha: a função tem
  -- search_path fixo e não é embutida pelo planner, e aqui ela rodaria uma
  -- vez por par candidato × valor
  score as (
    select c.praca_id, c.t,
      sum(b.n) filter (where x.k is not null and x.k <= b.e) as explicadas,
      sum(b.n) filter (where x.k = b.e) as completas
    from cand c
    join base b on b.praca_id = c.praca_id
    cross join lateral (
      select case
        when q.cheio between 1 and 12
          and abs(b.v - round(c.t * q.cheio, 2)) <= 0.02 then q.cheio
        when q.tag between 1 and 12
          and least(abs(b.v - round(c.t * q.tag * 0.95, 2)),
                    abs(b.v - round(round(c.t * 0.95, 2) * q.tag, 2))) <= 0.02 then q.tag
      end as k
      from (select round(b.v / c.t)::int as cheio, round(b.v / (c.t * 0.95))::int as tag) q
    ) x
    where c.t > 0
    group by c.praca_id, c.t
  ),
  melhor as (
    select distinct on (s.praca_id) s.praca_id, s.t, coalesce(s.explicadas, 0) as explicadas
    from score s
    left join pedagio.tarifa_eixo_osm o on o.praca_id = s.praca_id
    order by s.praca_id, s.explicadas desc nulls last, s.completas desc nulls last,
      (o.valor_eixo = s.t) desc nulls last, s.t desc
  ),
  totais as (
    select praca_id, sum(n)::int as total, min(d0) as d0, max(d1) as d1
    from base group by praca_id
  )
  insert into pedagio.tarifa_eixo_sugestao (
    praca_id, periodo_inicio, periodo_fim, valor_eixo_fatura, passagens_total, passagens_explicadas,
    valor_eixo_osm, osm_conferido_em, fontes_concordam
  )
  select m.praca_id, tt.d0, tt.d1, m.t, tt.total, m.explicadas,
    o.valor_eixo, o.osm_conferido_em, coalesce(abs(o.valor_eixo - m.t) <= 0.01, false)
  from melhor m
  join totais tt on tt.praca_id = m.praca_id
  left join pedagio.tarifa_eixo_osm o on o.praca_id = m.praca_id;

  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$$;

-- aprovar: grava a tarifa por eixo (valor da fatura ou do OSM) com vigência a
-- partir do início do período da sugestão, fechando a tarifa aberta anterior
-- da praça. A gravação revalida as passagens da praça (trigger); como
-- SECURITY INVOKER a revalidação passava pela RLS linha a linha (12 ms por
-- passagem medidos) — mesmo padrão das funções de importação em blocos da
-- FASE 23: SECURITY DEFINER com a checagem de admin na entrada. O app ainda
-- aprova em blocos limitados por quantidade de passagens.
create or replace function pedagio.aprovar_sugestoes_tarifa(p_ids uuid[], p_fonte text default 'fatura')
returns int
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_sug pedagio.tarifa_eixo_sugestao;
  v_valor numeric(10,2);
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
    order by id
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

    insert into pedagio.tarifa_praca (praca_id, valor_eixo, vigencia_inicio, origem)
    values (v_sug.praca_id, v_valor, v_sug.periodo_inicio, 'sugestao')
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

create or replace function pedagio.descartar_sugestoes_tarifa(p_ids uuid[])
returns int
language plpgsql
set search_path to ''
as $$
declare
  v_qtd int;
begin
  if not pedagio.eh_admin() then
    raise exception 'apenas administradores podem descartar sugestões de tarifa';
  end if;

  update pedagio.tarifa_eixo_sugestao
  set status = 'descartada',
      decidido_por = coalesce((select auth.jwt()) ->> 'email', current_user),
      decidido_em = now()
  where id = any(p_ids) and status = 'pendente';

  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$$;

-- 8) passagens das praças com tarifa convertida passam pela regra nova
do $$
declare
  v_id uuid;
begin
  for v_id in
    select pp.id from pedagio.passagem_pedagio pp
    where pp.tipo_uso = 'passagem'
      and pp.praca_id in (select praca_id from pedagio.tarifa_praca)
  loop
    perform pedagio.validar_passagem(v_id);
  end loop;
end;
$$;
