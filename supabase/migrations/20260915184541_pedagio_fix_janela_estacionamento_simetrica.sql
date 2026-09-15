-- Ajuste pós-FASE 20: bug real encontrado com dado GPS real. validar_estacionamento
-- buscava pings de GPS numa janela [data_hora - 30 dias, data_hora + 10min] — o
-- limite de +10min (janela_tolerancia_validacao, pensada pra passagem pontual em
-- praça) era curto demais: a data_hora da fatura não é garantidamente o instante
-- exato da saída, pode ficar no meio da permanência real (visto num caso real:
-- fatura às 22:51:30, mas o ping de saída real só chegou às 23:35, 43min depois).
-- Corrigido pra janela simétrica de 30 dias pra trás E pra frente — a escolha da
-- corrida mais próxima/relevante à data_hora (já existente) continua responsável
-- por não pegar um período errado só porque a janela ficou mais larga.
create or replace function pedagio.validar_estacionamento(p_passagem_id uuid)
returns pedagio.validacao_estacionamento
language plpgsql
set search_path = ''
as $$
declare
  v_passagem pedagio.passagem_pedagio;
  v_estacionamento pedagio.estacionamento;
  v_janela_busca interval := pedagio.janela_busca_estacionamento();
  v_gap interval := pedagio.gap_continuidade_estacionamento();
  v_entrada timestamptz;
  v_saida timestamptz;
  v_diarias int;
  v_tarifa numeric(10,2);
  v_valor_esperado numeric(10,2);
  v_divergencia numeric(10,2);
  v_resultado text;
  v_validacao pedagio.validacao_estacionamento;
begin
  select * into v_passagem from pedagio.passagem_pedagio where id = p_passagem_id;
  if not found then
    raise exception 'passagem % nao encontrada', p_passagem_id;
  end if;

  if v_passagem.veiculo_id is null or v_passagem.estacionamento_id is null then
    update pedagio.passagem_pedagio set status_validacao = 'sem_cadastro' where id = p_passagem_id;
    return null;
  end if;

  select * into v_estacionamento from pedagio.estacionamento where id = v_passagem.estacionamento_id;

  with dentro as (
    select pv.data_hora
    from pedagio.posicao_veiculo pv
    where pv.veiculo_id = v_passagem.veiculo_id
      and pv.data_hora between v_passagem.data_hora - v_janela_busca and v_passagem.data_hora + v_janela_busca
      and extensions.ST_Contains(v_estacionamento.poligono, pv.geom)
  ),
  marcado as (
    select data_hora,
      (lag(data_hora) over (order by data_hora) is null
        or data_hora - lag(data_hora) over (order by data_hora) > v_gap) as novo_run
    from dentro
  ),
  grupos as (
    select data_hora, sum(case when novo_run then 1 else 0 end) over (order by data_hora) as grp
    from marcado
  ),
  corridas as (
    select grp, min(data_hora) as entrada, max(data_hora) as saida
    from grupos
    group by grp
  )
  select entrada, saida into v_entrada, v_saida
  from corridas
  order by
    case when v_passagem.data_hora between entrada and saida then 0 else 1 end,
    abs(extract(epoch from saida - v_passagem.data_hora))
  limit 1;

  if v_entrada is null then
    v_resultado := 'sem_dados_gps';
    v_diarias := null;
    v_tarifa := null;
    v_valor_esperado := null;
    v_divergencia := null;
  else
    v_diarias := greatest(1, ceil(extract(epoch from (v_saida - v_entrada)) / 86400.0)::int);

    select te.valor_diaria into v_tarifa
    from pedagio.tarifa_estacionamento te
    where te.estacionamento_id = v_estacionamento.id
      and te.vigencia_inicio <= (v_entrada at time zone 'America/Sao_Paulo')::date
      and (te.vigencia_fim is null or te.vigencia_fim >= (v_entrada at time zone 'America/Sao_Paulo')::date);

    if v_tarifa is not null then
      v_valor_esperado := v_diarias * v_tarifa;
      v_divergencia := v_passagem.valor_cobrado - v_valor_esperado;
    else
      v_valor_esperado := null;
      v_divergencia := null;
    end if;

    if v_divergencia is null or v_divergencia = 0 then
      v_resultado := 'ok';
    else
      v_resultado := 'valor_divergente';
    end if;
  end if;

  insert into pedagio.validacao_estacionamento (
    passagem_id, entrada_detectada, saida_detectada, diarias_detectadas,
    tarifa_diaria_aplicada, valor_esperado, divergencia_valor, resultado, validado_em
  ) values (
    p_passagem_id, v_entrada, v_saida, v_diarias,
    v_tarifa, v_valor_esperado, v_divergencia, v_resultado, now()
  )
  on conflict (passagem_id) do update set
    entrada_detectada = excluded.entrada_detectada,
    saida_detectada = excluded.saida_detectada,
    diarias_detectadas = excluded.diarias_detectadas,
    tarifa_diaria_aplicada = excluded.tarifa_diaria_aplicada,
    valor_esperado = excluded.valor_esperado,
    divergencia_valor = excluded.divergencia_valor,
    resultado = excluded.resultado,
    validado_em = now()
  returning * into v_validacao;

  update pedagio.passagem_pedagio set status_validacao = v_resultado where id = p_passagem_id;

  return v_validacao;
end;
$$;
