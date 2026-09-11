-- FASE 12: mapa da validação geoespacial na tela de detalhe da passagem
-- (polígono da praça + ponto de GPS usado). vw_passagens_detalhado ganha
-- posicao_veiculo_id pra permitir buscar o ping via vw_posicao_veiculo
-- (já existe, FASE 11) sem precisar de view nova.
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
  vp.valor_esperado,
  vp.divergencia_valor,
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
  vp.posicao_veiculo_id
from pedagio.passagem_pedagio pp
left join pedagio.veiculo v on v.id = pp.veiculo_id
left join pedagio.praca_pedagio pc on pc.id = pp.praca_id
left join pedagio.validacao_passagem vp on vp.passagem_id = pp.id;
