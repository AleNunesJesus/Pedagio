-- Correção: service_role nunca recebeu acesso ao schema pedagio (só authenticated
-- foi concedido na FASE 06.1). service_role deve sempre ter acesso total, igual
-- já tem por padrão no schema public, para uso administrativo/server-side.

grant usage on schema pedagio to service_role;
grant select, insert, update, delete on all tables in schema pedagio to service_role;
grant usage on all sequences in schema pedagio to service_role;
grant execute on all functions in schema pedagio to service_role;

alter default privileges in schema pedagio grant select, insert, update, delete on tables to service_role;
alter default privileges in schema pedagio grant usage on sequences to service_role;
alter default privileges in schema pedagio grant execute on functions to service_role;
