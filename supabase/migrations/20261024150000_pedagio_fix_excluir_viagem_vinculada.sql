-- Excluir um lote/viagem de transporte já vinculada a uma passagem (FASE 21:
-- validacao_passagem.viagem_transporte_id) falhava com violação de FK — a
-- referência não tinha ação no delete. Achado ao limpar um teste da FASE 23.
-- Com ON DELETE SET NULL a referência some junto com a viagem;
-- excluir_viagens_transporte já revalida as passagens afetadas logo depois,
-- recalculando vínculo/status.
alter table pedagio.validacao_passagem drop constraint validacao_passagem_viagem_transporte_id_fkey;
alter table pedagio.validacao_passagem add constraint validacao_passagem_viagem_transporte_id_fkey
  foreign key (viagem_transporte_id) references pedagio.viagem_transporte(id) on delete set null;
