-- FASE 03: função de validação geoespacial + tarifária, processamento em lote e revalidação automática

-- Janela de tolerância isolada numa função para não duplicar o valor entre validar_passagem e o
-- trigger de revalidação. Fixa em ±10 minutos (decisão do usuário); se um dia precisar variar por
-- praça, basta trocar esta função para ler de uma coluna em praca_pedagio.
create function pedagio.janela_tolerancia_validacao()
returns interval
language sql
immutable
as $$
  select interval '10 minutes'
$$;

create function pedagio.validar_passagem(p_passagem_id uuid)
returns pedagio.validacao_passagem
language plpgsql
as $$
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

  -- tarifário: tarifa vigente na data da passagem para praça + categoria do veículo
  select tp.valor into v_tarifa
  from pedagio.tarifa_praca tp
  join pedagio.veiculo v on v.id = v_passagem.veiculo_id
  where tp.praca_id = v_passagem.praca_id
    and tp.categoria_veiculo_id = v.categoria_veiculo_id
    and tp.vigencia_inicio <= v_passagem.data_hora::date
    and (tp.vigencia_fim is null or tp.vigencia_fim >= v_passagem.data_hora::date);

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
$$;

-- processamento em lote (chamado após importação, ou por job agendado)
create function pedagio.processar_validacoes_pendentes()
returns int
language plpgsql
as $$
declare
  v_id uuid;
  v_count int := 0;
begin
  for v_id in
    select id from pedagio.passagem_pedagio where status_validacao in ('pendente', 'sem_dados_gps')
  loop
    perform pedagio.validar_passagem(v_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- revalidação automática: ao chegar um novo ping de GPS, reprocessa passagens do mesmo veículo
-- que ainda estavam pendentes/sem_dados_gps e caem dentro da janela de tolerância desse ping
create function pedagio.trg_revalidar_passagens_por_posicao()
returns trigger
language plpgsql
as $$
declare
  v_janela interval := pedagio.janela_tolerancia_validacao();
  v_id uuid;
begin
  for v_id in
    select pp.id
    from pedagio.passagem_pedagio pp
    where pp.veiculo_id = new.veiculo_id
      and pp.status_validacao in ('pendente', 'sem_dados_gps')
      and pp.data_hora between new.data_hora - v_janela and new.data_hora + v_janela
  loop
    perform pedagio.validar_passagem(v_id);
  end loop;
  return new;
end;
$$;

create trigger posicao_veiculo_revalidar_passagens
after insert on pedagio.posicao_veiculo
for each row
execute function pedagio.trg_revalidar_passagens_por_posicao();
