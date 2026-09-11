-- FASE 11: visibilidade das posições de GPS (mapa + lista por veículo/
-- período). View de leitura que expõe lat/lon já extraídos do geom, no
-- mesmo espírito de vw_praca_pedagio_mapa (ST_AsGeoJSON) — aqui, como é
-- uma lista de pontos e não um polígono, extrair lat/lon direto (ST_Y/ST_X)
-- é mais simples de consumir tanto pelo mapa quanto pela tabela.
create or replace view pedagio.vw_posicao_veiculo
with (security_invoker = true)
as
select
  pv.id,
  pv.veiculo_id,
  v.placa,
  extensions.ST_Y(pv.geom) as latitude,
  extensions.ST_X(pv.geom) as longitude,
  pv.data_hora,
  pv.fonte,
  pv.lote_importacao_id
from pedagio.posicao_veiculo pv
join pedagio.veiculo v on v.id = pv.veiculo_id;
