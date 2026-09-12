create or replace function pedagio.excluir_viagens_transporte(p_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_passagens_afetadas uuid[];
  v_id uuid;
begin
  if not pedagio.eh_admin() then
    raise exception 'apenas administradores podem excluir viagens de transporte';
  end if;

  select array_agg(distinct pp.id) into v_passagens_afetadas
  from pedagio.viagem_transporte vt
  join pedagio.passagem_pedagio pp
    on upper(trim(pp.placa_informada)) = upper(trim(vt.placa_informada))
    and pp.data_hora between vt.data_hora_saida and vt.data_hora_chegada
  where vt.id = any(p_ids);

  delete from pedagio.viagem_transporte where id = any(p_ids);

  if v_passagens_afetadas is not null then
    foreach v_id in array v_passagens_afetadas loop
      perform pedagio.validar_passagem(v_id);
    end loop;
  end if;
end;
$$;

create or replace function pedagio.excluir_lote_importacao(p_lote_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_ids_posicao bigint[];
  v_ids_viagem uuid[];
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

  select array_agg(id) into v_ids_viagem
  from pedagio.viagem_transporte where lote_importacao_id = p_lote_id;
  if v_ids_viagem is not null then
    perform pedagio.excluir_viagens_transporte(v_ids_viagem);
  end if;

  delete from pedagio.lote_importacao where id = p_lote_id;
end;
$$;

drop trigger if exists revalidar_apos_cadastro_carreta on pedagio.carreta;

create or replace function pedagio.trigger_revalidar_por_carreta()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform pedagio.revalidar_passagens_por_carreta(new.placa);
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    perform pedagio.revalidar_passagens_por_carreta(old.placa);
  end if;
  return coalesce(new, old);
end;
$$;

create trigger revalidar_apos_alteracao_carreta
  after insert or update or delete on pedagio.carreta
  for each row execute function pedagio.trigger_revalidar_por_carreta();
