alter table pedagio.validacao_passagem
  add column categoria_veiculo_id uuid references pedagio.categoria_veiculo(id),
  add column origem_categoria text check (origem_categoria in ('composicao_viagem', 'cadastro_veiculo'));

create or replace function pedagio.categoria_por_composicao(p_placa text, p_data_hora timestamptz)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_viagem pedagio.viagem_transporte;
  v_eixos_carreta1 int;
  v_eixos_carreta2 int;
  v_total_eixos int;
  v_categoria_id uuid;
begin
  select vt.* into v_viagem
  from pedagio.viagem_transporte vt
  where upper(trim(vt.placa_informada)) = upper(trim(p_placa))
    and p_data_hora between vt.data_hora_saida and vt.data_hora_chegada
  order by vt.data_hora_saida
  limit 1;

  if not found or v_viagem.carreta1 is null or trim(v_viagem.carreta1) = '' then
    return null;
  end if;

  select case c.tipo when 'comum' then 3 when 'vanderleia' then 4 end into v_eixos_carreta1
  from pedagio.carreta c
  where upper(trim(c.placa)) = upper(trim(v_viagem.carreta1));

  if v_eixos_carreta1 is null then
    return null;
  end if;

  v_total_eixos := 3 + v_eixos_carreta1;

  if v_viagem.carreta2 is not null and trim(v_viagem.carreta2) <> '' then
    select case c.tipo when 'comum' then 3 when 'vanderleia' then 4 end into v_eixos_carreta2
    from pedagio.carreta c
    where upper(trim(c.placa)) = upper(trim(v_viagem.carreta2));

    if v_eixos_carreta2 is null then
      return null;
    end if;

    v_total_eixos := v_total_eixos + v_eixos_carreta2;
  end if;

  select id into v_categoria_id
  from pedagio.categoria_veiculo
  where codigo = 'EIXO_' || v_total_eixos;

  return v_categoria_id;
end;
$$;

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
begin
  select * into v_passagem from pedagio.passagem_pedagio where id = p_passagem_id;
  if not found then
    raise exception 'passagem % nao encontrada', p_passagem_id;
  end if;

  if v_passagem.veiculo_id is null or v_passagem.praca_id is null then
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
    select categoria_veiculo_id into v_categoria_id from pedagio.veiculo where id = v_passagem.veiculo_id;
    v_origem_categoria := 'cadastro_veiculo';
  end if;

  select tp.valor into v_tarifa
  from pedagio.tarifa_praca tp
  where tp.praca_id = v_passagem.praca_id
    and tp.categoria_veiculo_id = v_categoria_id
    and tp.vigencia_inicio <= (v_passagem.data_hora at time zone 'America/Sao_Paulo')::date
    and (tp.vigencia_fim is null or tp.vigencia_fim >= (v_passagem.data_hora at time zone 'America/Sao_Paulo')::date);

  if v_tarifa is not null then
    v_divergencia := v_passagem.valor_cobrado - v_tarifa;
  else
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
    diferenca_segundos, valor_esperado, divergencia_valor, resultado, validado_em,
    categoria_veiculo_id, origem_categoria
  ) values (
    p_passagem_id, v_posicao.id, v_dentro, v_distancia,
    v_diferenca, v_tarifa, v_divergencia, v_resultado, now(),
    v_categoria_id, v_origem_categoria
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
    origem_categoria = excluded.origem_categoria
  returning * into v_validacao;

  update pedagio.passagem_pedagio set status_validacao = v_resultado where id = p_passagem_id;

  return v_validacao;
end;
$function$;
