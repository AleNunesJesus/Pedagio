-- FASE 19: separa valor_pedagios (janela viagem_transporte x passagens da
-- mesma placa, já existente desde a FASE 13) em duas partes:
--   - valor_pedagios_confirmado: passagens com validacao_passagem.dentro_poligono
--     = true, ou seja, o GPS do veículo realmente colocou ele dentro do
--     polígono da praça naquele horário.
--   - valor_pedagios_estimado: passagens que caem na janela saída/chegada da
--     viagem (mesma placa, mesmo critério de hoje) mas sem confirmação
--     geoespacial (fora do polígono, sem dado de GPS ou ainda pendente de
--     validação) — é um palpite plausível pela coincidência de data, não uma
--     confirmação de que aquela passagem pertence à viagem.
-- valor_pedagios continua sendo a soma das duas (confirmado + estimado);
-- nenhum comportamento existente muda pra quem já lê essa coluna.
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
  coalesce(p.valor_pedagios_estimado, 0) as valor_pedagios_estimado
from pedagio.viagem_transporte vt
left join pedagio.embarcador e on e.id = vt.embarcador_id
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
