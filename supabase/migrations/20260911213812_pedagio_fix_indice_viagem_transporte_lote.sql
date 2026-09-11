-- Faltou na FASE 13 — mesmo padrão de posicao_veiculo/passagem_pedagio.
create index viagem_transporte_lote_importacao_id_idx on pedagio.viagem_transporte (lote_importacao_id);
