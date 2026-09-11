-- Coluna "valor dos pedágios apurados" na tela de Viagens: soma
-- valor_cobrado das passagens reais (tipo_uso = 'passagem', ignora
-- lançamentos de contrato) do mesmo veículo (por placa, já que
-- viagem_transporte.veiculo_id pode ser null) dentro da janela
-- saída/chegada da viagem.
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
  (
    select coalesce(sum(pp.valor_cobrado), 0)
    from pedagio.passagem_pedagio pp
    where upper(trim(pp.placa_informada)) = upper(trim(vt.placa_informada))
      and pp.tipo_uso = 'passagem'
      and pp.data_hora between vt.data_hora_saida and vt.data_hora_chegada
  ) as valor_pedagios
from pedagio.viagem_transporte vt
left join pedagio.embarcador e on e.id = vt.embarcador_id;
