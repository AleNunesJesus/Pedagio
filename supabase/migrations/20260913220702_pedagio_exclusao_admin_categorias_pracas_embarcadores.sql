-- Exclusão admin-only (mesmo padrão de excluir_veiculos/excluir_tarifas):
-- RLS exclusao_admin já existe nas 3 tabelas desde a FASE08; estas funções
-- só formalizam a checagem + dão um ponto único pro frontend chamar via RPC.
-- Nenhuma das FKs que apontam pra essas 3 tabelas tem cascade/set null, então
-- excluir um registro em uso é bloqueado pelo Postgres (23503) e a action
-- traduz isso pra uma mensagem amigável.

create or replace function pedagio.excluir_categorias(p_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $function$
begin
  if not pedagio.eh_admin() then
    raise exception 'apenas administradores podem excluir categorias';
  end if;

  delete from pedagio.categoria_veiculo where id = any(p_ids);
end;
$function$;

create or replace function pedagio.excluir_pracas(p_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $function$
begin
  if not pedagio.eh_admin() then
    raise exception 'apenas administradores podem excluir pracas';
  end if;

  delete from pedagio.praca_pedagio where id = any(p_ids);
end;
$function$;

create or replace function pedagio.excluir_embarcadores(p_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $function$
begin
  if not pedagio.eh_admin() then
    raise exception 'apenas administradores podem excluir embarcadores';
  end if;

  delete from pedagio.embarcador where id = any(p_ids);
end;
$function$;
