-- Exclusão de registros (admin-only, além da policy RLS já existente
-- "exclusao_admin" em passagem_pedagio/posicao_veiculo/viagem_transporte/
-- lote_importacao/validacao_passagem — o que faltava era o app expor a
-- ação e tratar os relacionamentos entre tabelas).

-- validacao_passagem referencia passagem_pedagio/posicao_veiculo sem
-- ON DELETE definido (RESTRICT por padrão), o que travaria qualquer
-- exclusão direta. passagem_id vira CASCADE (a validação não faz sentido
-- sem a passagem); posicao_veiculo_id vira SET NULL (apagar um ping não
-- deve apagar o resultado da validação, só a evidência específica —
-- por isso a revalidação explícita dentro de excluir_posicoes abaixo).
alter table pedagio.validacao_passagem
  drop constraint validacao_passagem_passagem_id_fkey,
  add constraint validacao_passagem_passagem_id_fkey
    foreign key (passagem_id) references pedagio.passagem_pedagio(id) on delete cascade;

alter table pedagio.validacao_passagem
  drop constraint validacao_passagem_posicao_veiculo_id_fkey,
  add constraint validacao_passagem_posicao_veiculo_id_fkey
    foreign key (posicao_veiculo_id) references pedagio.posicao_veiculo(id) on delete set null;

create or replace function pedagio.excluir_passagens(p_ids uuid[])
returns void
language plpgsql
set search_path to ''
as $function$
begin
  if not pedagio.eh_admin() then
    raise exception 'apenas administradores podem excluir passagens';
  end if;

  delete from pedagio.passagem_pedagio where id = any(p_ids);
end;
$function$;

-- Ao apagar pings de GPS, qualquer passagem que usava um deles como
-- evidência (validacao_passagem.posicao_veiculo_id) precisa ser
-- revalidada — senão ficaria com status/resultado desatualizado
-- (ex.: continuar "ok" sem nenhum ping de evidência).
create or replace function pedagio.excluir_posicoes(p_ids bigint[])
returns void
language plpgsql
set search_path to ''
as $function$
declare
  v_passagens_afetadas uuid[];
  v_id uuid;
begin
  if not pedagio.eh_admin() then
    raise exception 'apenas administradores podem excluir posições de GPS';
  end if;

  select array_agg(distinct passagem_id) into v_passagens_afetadas
  from pedagio.validacao_passagem
  where posicao_veiculo_id = any(p_ids);

  delete from pedagio.posicao_veiculo where id = any(p_ids);

  if v_passagens_afetadas is not null then
    foreach v_id in array v_passagens_afetadas loop
      perform pedagio.validar_passagem(v_id);
    end loop;
  end if;
end;
$function$;

create or replace function pedagio.excluir_viagens_transporte(p_ids uuid[])
returns void
language plpgsql
set search_path to ''
as $function$
begin
  if not pedagio.eh_admin() then
    raise exception 'apenas administradores podem excluir viagens de transporte';
  end if;

  delete from pedagio.viagem_transporte where id = any(p_ids);
end;
$function$;

-- Exclui um lote de importação inteiro: todas as linhas que vieram
-- daquele arquivo (passagens, posições ou viagens de transporte,
-- dependendo do tipo do lote) mais o próprio lote.
create or replace function pedagio.excluir_lote_importacao(p_lote_id uuid)
returns void
language plpgsql
set search_path to ''
as $function$
declare
  v_ids_posicao bigint[];
begin
  if not pedagio.eh_admin() then
    raise exception 'apenas administradores podem excluir lotes de importação';
  end if;

  delete from pedagio.passagem_pedagio where lote_importacao_id = p_lote_id;

  select array_agg(id) into v_ids_posicao
  from pedagio.posicao_veiculo where lote_importacao_id = p_lote_id;
  if v_ids_posicao is not null then
    perform pedagio.excluir_posicoes(v_ids_posicao);
  end if;

  delete from pedagio.viagem_transporte where lote_importacao_id = p_lote_id;

  delete from pedagio.lote_importacao where id = p_lote_id;
end;
$function$;
