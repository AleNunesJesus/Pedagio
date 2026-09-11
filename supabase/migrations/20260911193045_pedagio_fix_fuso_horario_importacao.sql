-- Bug real: parse_data_hora_planilha usava to_timestamp(...), que trata o
-- texto da planilha (horario local do Brasil) como se já fosse UTC. Uma
-- posição informada como 20:11:00 ficava gravada como 2026-08-31
-- 20:11:00+00 (UTC), e ao exibir convertendo UTC -> horário local (Brasil,
-- UTC-3) aparecia como 17:11:00 — 3h "atrasado" na tela.
--
-- Como o mesmo bug afetava igualmente passagem_pedagio e posicao_veiculo,
-- a comparação relativa entre elas (janela de tolerância, geoespacial)
-- continuava correta; só a exibição do horário absoluto ficava errada.
--
-- Efeito colateral: validar_passagem comparava passagem.data_hora::date
-- (cast usa UTC) contra a vigência da tarifa. Uma passagem perto da
-- meia-noite local, ao ter o instante UTC corrigido, pode virar o dia em
-- UTC e cair fora da vigência cadastrada — a comparação de vigência
-- também precisa ser pela data local, não UTC.
create or replace function pedagio.parse_data_hora_planilha(p_data text, p_horario text)
returns timestamptz
language plpgsql
immutable
set search_path to ''
as $function$
declare
  v_data text := trim(p_data);
  v_horario text := trim(p_horario);
begin
  if v_data is null or v_data = '' or v_horario is null or v_horario = '' then
    return null;
  end if;

  begin
    return (to_timestamp(v_data || ' ' || v_horario, 'DD/MM/YYYY HH24:MI:SS')::timestamp)
      at time zone 'America/Sao_Paulo';
  exception when others then
    begin
      return (to_timestamp(v_data || ' ' || v_horario, 'DD/MM/YYYY HH24:MI')::timestamp)
        at time zone 'America/Sao_Paulo';
    exception when others then
      return null;
    end;
  end;
end;
$function$;

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
begin
  select * into v_passagem from pedagio.passagem_pedagio where id = p_passagem_id;
  if not found then
    raise exception 'passagem % nao encontrada', p_passagem_id;
  end if;

  -- placa/praça informadas não bateram com cadastro: não há o que cruzar geo/tarifa
  if v_passagem.veiculo_id is null or v_passagem.praca_id is null then
    update pedagio.passagem_pedagio set status_validacao = 'sem_cadastro' where id = p_passagem_id;
    return null;
  end if;

  -- geoespacial: ping do veículo dentro da janela E dentro do polígono da praça, mais próximo no tempo
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
    -- nenhum ping dentro do polígono; existe algum ping na janela mesmo assim?
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

  -- tarifário: tarifa vigente na data (local, Brasil) da passagem para praça + categoria do veículo
  select tp.valor into v_tarifa
  from pedagio.tarifa_praca tp
  join pedagio.veiculo v on v.id = v_passagem.veiculo_id
  where tp.praca_id = v_passagem.praca_id
    and tp.categoria_veiculo_id = v.categoria_veiculo_id
    and tp.vigencia_inicio <= (v_passagem.data_hora at time zone 'America/Sao_Paulo')::date
    and (tp.vigencia_fim is null or tp.vigencia_fim >= (v_passagem.data_hora at time zone 'America/Sao_Paulo')::date);

  if v_tarifa is not null then
    v_divergencia := v_passagem.valor_cobrado - v_tarifa;
  else
    -- sem tarifa cadastrada para o período: não dá pra avaliar divergência de valor, só a geo conta
    v_divergencia := null;
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
    diferenca_segundos, valor_esperado, divergencia_valor, resultado, validado_em
  ) values (
    p_passagem_id, v_posicao.id, v_dentro, v_distancia,
    v_diferenca, v_tarifa, v_divergencia, v_resultado, now()
  )
  on conflict (passagem_id) do update set
    posicao_veiculo_id = excluded.posicao_veiculo_id,
    dentro_poligono = excluded.dentro_poligono,
    distancia_metros = excluded.distancia_metros,
    diferenca_segundos = excluded.diferenca_segundos,
    valor_esperado = excluded.valor_esperado,
    divergencia_valor = excluded.divergencia_valor,
    resultado = excluded.resultado,
    validado_em = now()
  returning * into v_validacao;

  update pedagio.passagem_pedagio set status_validacao = v_resultado where id = p_passagem_id;

  return v_validacao;
end;
$function$;

-- Corrige os dados de teste já importados com o parse antigo (+3h, já que
-- estavam gravados como se o horário local já fosse UTC).
update pedagio.passagem_pedagio set data_hora = data_hora + interval '3 hours';
update pedagio.posicao_veiculo set data_hora = data_hora + interval '3 hours';

-- Revalida tudo (não só as pendentes) para garantir consistência com a
-- correção da vigência de tarifa por data local.
do $$
declare
  v_id uuid;
begin
  for v_id in select id from pedagio.passagem_pedagio where tipo_uso = 'passagem' loop
    perform pedagio.validar_passagem(v_id);
  end loop;
end;
$$;
