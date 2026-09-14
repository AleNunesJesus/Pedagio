-- Exclusão de veículo/carreta (admin-only), mesmo padrão de excluir_tarifas/
-- excluir_passagens/etc.: RLS (exclusao_admin, já existente desde a FASE08)
-- já bloqueia não-admin, esta função só formaliza a checagem + dá um ponto
-- único para o frontend chamar via RPC.
create or replace function pedagio.excluir_veiculos(p_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $function$
begin
  if not pedagio.eh_admin() then
    raise exception 'apenas administradores podem excluir veiculos';
  end if;

  delete from pedagio.veiculo where id = any(p_ids);
end;
$function$;
