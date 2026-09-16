-- Coluna "frota" (texto livre em pedagio.veiculo) passa a aparecer ao lado
-- da placa em /passagens e /viagens-transporte. Anexada ao final de cada
-- view (create or replace view não permite inserir coluna no meio,
-- restrição já documentada na FASE 19/21).

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
  vp.numero_viagem_bate,
  v.frota
from pedagio.passagem_pedagio pp
left join pedagio.veiculo v on v.id = pp.veiculo_id
left join pedagio.praca_pedagio pc on pc.id = pp.praca_id
left join pedagio.validacao_passagem vp on vp.passagem_id = pp.id
left join pedagio.categoria_veiculo cv on cv.id = vp.categoria_veiculo_id
left join pedagio.validacao_estacionamento ve on ve.passagem_id = pp.id
left join pedagio.estacionamento est on est.id = pp.estacionamento_id
left join pedagio.viagem_transporte vt on vt.id = vp.viagem_transporte_id;

create or replace view pedagio.vw_viagem_transporte_detalhado
with (security_invoker = true)
as
select
  vt.id,
  vt.numero_transporte,
  vt.veiculo_id,
  vt.placa_informada,
  vt.cidade_origem,
  vt.uf_origem,
  vt.cidade_destino,
  vt.uf_destino,
  vt.data_hora_saida,
  vt.data_hora_chegada,
  vt.carreta1,
  vt.carreta2,
  vt.tipo_viagem,
  vt.embarcador_id,
  e.nome as embarcador_nome,
  vt.lote_importacao_id,
  vt.created_at,
  coalesce(p.valor_pedagios, 0) as valor_pedagios,
  coalesce(p.valor_tarifa_esperada, 0) as valor_tarifa_esperada,
  coalesce(p.valor_pedagios, 0) - coalesce(p.valor_tarifa_esperada, 0) as divergencia_valor,
  coalesce(p.valor_pedagios_confirmado, 0) as valor_pedagios_confirmado,
  coalesce(p.valor_pedagios_estimado, 0) as valor_pedagios_estimado,
  v.frota
from pedagio.viagem_transporte vt
left join pedagio.embarcador e on e.id = vt.embarcador_id
left join pedagio.veiculo v on v.id = vt.veiculo_id
left join lateral (
  select
    sum(pp.valor_cobrado) as valor_pedagios,
    sum(pp.valor_cobrado) filter (where vp.dentro_poligono) as valor_pedagios_confirmado,
    sum(pp.valor_cobrado) filter (where vp.dentro_poligono is distinct from true) as valor_pedagios_estimado,
    sum(vp.valor_esperado) as valor_tarifa_esperada
  from pedagio.passagem_pedagio pp
  left join pedagio.validacao_passagem vp on vp.passagem_id = pp.id
  where upper(trim(pp.placa_informada)) = upper(trim(vt.placa_informada))
    and pp.tipo_uso = 'passagem'
    and pp.data_hora between vt.data_hora_saida and vt.data_hora_chegada
) p on true;
