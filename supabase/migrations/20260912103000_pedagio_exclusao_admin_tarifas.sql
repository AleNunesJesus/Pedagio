-- Exclusão de tarifas (admin-only), mesmo padrão já aplicado a
-- passagens/posições/viagens de transporte/lotes (migration
-- 20260911223015_pedagio_exclusao_admin_registros): checagem explícita de
-- eh_admin() dentro da função, além da policy RLS "exclusao_admin" que já
-- existia em tarifa_praca desde a FASE 08. Motivo do pedido: risco de
-- cadastrar uma tarifa equivocada, precisa de forma segura de corrigir.
-- tarifa_praca não tem nenhuma tabela dependente (nenhuma FK referencia
-- tarifa_praca.id), então a exclusão é direta, sem revalidação em cascata.
create or replace function pedagio.excluir_tarifas(p_ids uuid[])
returns void
language plpgsql
set search_path to ''
as $function$
begin
  if not pedagio.eh_admin() then
    raise exception 'apenas administradores podem excluir tarifas';
  end if;

  delete from pedagio.tarifa_praca where id = any(p_ids);
end;
$function$;
