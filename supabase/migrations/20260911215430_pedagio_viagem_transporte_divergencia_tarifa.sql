-- Coluna "valor da praça" (tarifa esperada) + divergência por viagem:
-- mesmo cruzamento de valor_pedagios (placa + janela saída/chegada,
-- só tipo_uso='passagem'), agora somando também validacao_passagem.
-- valor_esperado. Usa lateral join pra computar os dois somatórios uma
-- única vez e permitir referenciar ambos na coluna de diferença.
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
  coalesce(p.valor_pedagios, 0) - coalesce(p.valor_tarifa_esperada, 0) as divergencia_valor
from pedagio.viagem_transporte vt
left join pedagio.embarcador e on e.id = vt.embarcador_id
left join lateral (
  select
    sum(pp.valor_cobrado) as valor_pedagios,
    sum(vp.valor_esperado) as valor_tarifa_esperada
  from pedagio.passagem_pedagio pp
  left join pedagio.validacao_passagem vp on vp.passagem_id = pp.id
  where upper(trim(pp.placa_informada)) = upper(trim(vt.placa_informada))
    and pp.tipo_uso = 'passagem'
    and pp.data_hora between vt.data_hora_saida and vt.data_hora_chegada
) p on true;
