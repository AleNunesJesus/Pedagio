-- View de leitura pra tela de consulta: traz o nome do embarcador junto
-- (embarcador_id sozinho não é útil pra exibir numa lista).
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
  vt.created_at
from pedagio.viagem_transporte vt
left join pedagio.embarcador e on e.id = vt.embarcador_id;
