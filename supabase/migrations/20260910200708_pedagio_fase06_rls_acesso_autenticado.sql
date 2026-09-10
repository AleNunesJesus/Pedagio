-- FASE 06 (passo 1): qualquer usuário autenticado tem acesso total ao schema pedagio.
-- Decisão do usuário: sem papéis diferenciados por enquanto (single-tenant, sem admin/operador ainda).

grant usage on schema pedagio to authenticated;
grant select, insert, update, delete on all tables in schema pedagio to authenticated;
grant usage on all sequences in schema pedagio to authenticated;
grant execute on all functions in schema pedagio to authenticated;

alter default privileges in schema pedagio grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema pedagio grant usage on sequences to authenticated;
alter default privileges in schema pedagio grant execute on functions to authenticated;

create policy "authenticated_full_access" on pedagio.categoria_veiculo
  for all to authenticated using (true) with check (true);

create policy "authenticated_full_access" on pedagio.praca_pedagio
  for all to authenticated using (true) with check (true);

create policy "authenticated_full_access" on pedagio.tarifa_praca
  for all to authenticated using (true) with check (true);

create policy "authenticated_full_access" on pedagio.veiculo
  for all to authenticated using (true) with check (true);

create policy "authenticated_full_access" on pedagio.lote_importacao
  for all to authenticated using (true) with check (true);

create policy "authenticated_full_access" on pedagio.posicao_veiculo
  for all to authenticated using (true) with check (true);

create policy "authenticated_full_access" on pedagio.passagem_pedagio
  for all to authenticated using (true) with check (true);

create policy "authenticated_full_access" on pedagio.validacao_passagem
  for all to authenticated using (true) with check (true);

create policy "authenticated_full_access" on pedagio.staging_passagem_pedagio
  for all to authenticated using (true) with check (true);
