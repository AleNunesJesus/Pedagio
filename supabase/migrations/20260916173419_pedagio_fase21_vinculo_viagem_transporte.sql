-- FASE 21: vínculo passagem × viagem_transporte (validação cruzada de
-- viagem). Resolve, por passagem individual, a viagem_transporte candidata
-- via placa + janela saída/chegada — mesma heurística já usada desde a
-- FASE 13/19 em vw_viagem_transporte_detalhado e no trigger de revalidação
-- da FASE 16 (revalidar_passagens_da_viagem/por_carreta) — mas agora
-- persistida por passagem, com status de ambiguidade explícito em vez de
-- escolher uma viagem sozinho quando há mais de uma candidata (decisão do
-- usuário: melhor deixar pendente pra revisão manual do que atribuir
-- errado silenciosamente). Só se aplica a tipo_uso = 'passagem', mesmo
-- recorte já usado no filtro da soma de valor_pedagios (FASE 13/19).
--
-- numero_viagem_bate compara viagem_informada (número cru da fatura) com
-- viagem_transporte.numero_transporte só quando o vínculo é único
-- ('vinculado') — os dois usam numeração de sistemas diferentes (nota já
-- registrada na FASE 13), então não bater não é, por si só, uma
-- divergência: é só informativo.

alter table pedagio.validacao_passagem
  add column viagem_transporte_id uuid references pedagio.viagem_transporte(id),
  add column vinculo_viagem_status text not null default 'sem_vinculo'
    check (vinculo_viagem_status in ('vinculado', 'ambiguo', 'sem_vinculo')),
  add column viagem_transporte_candidatas int not null default 0,
  add column numero_viagem_bate boolean;

create index validacao_passagem_viagem_transporte_id_idx
  on pedagio.validacao_passagem (viagem_transporte_id);

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
    select categoria_fallback_id into v_categoria_id from pedagio.veiculo where id = v_passagem.veiculo_id;
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
    viagem_transporte_id, vinculo_viagem_status, viagem_transporte_candidatas, numero_viagem_bate
  ) values (
    p_passagem_id, v_posicao.id, v_dentro, v_distancia,
    v_diferenca, v_tarifa, v_divergencia, v_resultado, now(),
    v_categoria_id, v_origem_categoria,
    v_viagem_transporte_id, v_vinculo_viagem_status, v_viagem_transporte_candidatas, v_numero_viagem_bate
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
    numero_viagem_bate = excluded.numero_viagem_bate
  returning * into v_validacao;

  update pedagio.passagem_pedagio set status_validacao = v_resultado where id = p_passagem_id;

  return v_validacao;
end;
$function$;

-- vw_passagens_detalhado: colunas novas só podem ser anexadas ao final
-- (create or replace view não reordena/insere no meio, mesma restrição já
-- documentada na FASE 19).
create or replace view pedagio.vw_passagens_detalhado
with (security_invoker = true)
as
select
  pp.id as passagem_id,
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
  vp.numero_viagem_bate
from pedagio.passagem_pedagio pp
left join pedagio.veiculo v on v.id = pp.veiculo_id
left join pedagio.praca_pedagio pc on pc.id = pp.praca_id
left join pedagio.validacao_passagem vp on vp.passagem_id = pp.id
left join pedagio.categoria_veiculo cv on cv.id = vp.categoria_veiculo_id
left join pedagio.validacao_estacionamento ve on ve.passagem_id = pp.id
left join pedagio.estacionamento est on est.id = pp.estacionamento_id
left join pedagio.viagem_transporte vt on vt.id = vp.viagem_transporte_id;

-- backfill: revalida todas as passagens tipo_uso='passagem' já existentes
-- pra preencher o vínculo novo (processar_validacoes_pendentes só
-- reprocessa status pendente/sem_dados_gps, não cobre as já resolvidas
-- como ok/valor_divergente/etc.). Idempotente — mesma função, mesmo
-- padrão on conflict do upsert acima.
do $$
declare
  v_id uuid;
begin
  for v_id in select id from pedagio.passagem_pedagio where tipo_uso = 'passagem'
  loop
    perform pedagio.validar_passagem(v_id);
  end loop;
end;
$$;
