create or replace function pedagio.revalidar_passagens_da_viagem(p_viagem_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_viagem pedagio.viagem_transporte;
  v_passagem_id uuid;
begin
  select * into v_viagem from pedagio.viagem_transporte where id = p_viagem_id;
  if not found then
    return;
  end if;

  for v_passagem_id in
    select id from pedagio.passagem_pedagio
    where upper(trim(placa_informada)) = upper(trim(v_viagem.placa_informada))
      and data_hora between v_viagem.data_hora_saida and v_viagem.data_hora_chegada
  loop
    perform pedagio.validar_passagem(v_passagem_id);
  end loop;
end;
$$;

create or replace function pedagio.revalidar_passagens_por_carreta(p_placa text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_viagem_id uuid;
begin
  for v_viagem_id in
    select id from pedagio.viagem_transporte
    where upper(trim(carreta1)) = upper(trim(p_placa))
       or upper(trim(carreta2)) = upper(trim(p_placa))
  loop
    perform pedagio.revalidar_passagens_da_viagem(v_viagem_id);
  end loop;
end;
$$;

create or replace function pedagio.trigger_revalidar_por_carreta()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pedagio.revalidar_passagens_por_carreta(new.placa);
  return new;
end;
$$;

create trigger revalidar_apos_cadastro_carreta
  after insert on pedagio.carreta
  for each row execute function pedagio.trigger_revalidar_por_carreta();

create or replace function pedagio.processar_staging_viagens_transporte(p_arquivo_nome text default null::text, p_usuario text default null::text)
 returns pedagio.lote_importacao
 language plpgsql
 set search_path to ''
as $function$
declare
  v_lote_id uuid;
  v_ids bigint[];
  v_row record;
  v_total int := 0;
  v_erros int := 0;
  v_saida timestamptz;
  v_chegada timestamptz;
  v_tipo_viagem text;
  v_veiculo_id uuid;
  v_embarcador_id uuid;
  v_viagem_id uuid;
  v_lote pedagio.lote_importacao;
begin
  select array_agg(id) into v_ids from pedagio.staging_viagem_transporte;
  if v_ids is null then
    raise exception 'pedagio.staging_viagem_transporte esta vazia, nada para importar';
  end if;

  insert into pedagio.lote_importacao (tipo, arquivo_nome, usuario, total_linhas, total_erros)
  values ('viagens_transporte', p_arquivo_nome, p_usuario, array_length(v_ids, 1), 0)
  returning id into v_lote_id;

  for v_row in select * from pedagio.staging_viagem_transporte where id = any(v_ids) order by id loop
    v_total := v_total + 1;

    begin
      v_saida := pedagio.parse_data_hora_combinada(v_row.data_hora_saida_texto);
      v_chegada := pedagio.parse_data_hora_combinada(v_row.data_hora_chegada_texto);
      v_tipo_viagem := pedagio.normalizar_tipo_viagem(v_row.tipo_viagem_texto);

      if v_row.numero_transporte is null or trim(v_row.numero_transporte) = ''
        or v_row.placa is null or trim(v_row.placa) = ''
        or v_saida is null or v_chegada is null or v_tipo_viagem is null then
        v_erros := v_erros + 1;
        continue;
      end if;

      select id into v_veiculo_id from pedagio.veiculo where upper(trim(placa)) = upper(trim(v_row.placa)) limit 1;

      select embarcador_id into v_embarcador_id
      from pedagio.passagem_pedagio
      where upper(trim(placa_informada)) = upper(trim(v_row.placa))
        and data_hora between v_saida and v_chegada
        and embarcador_id is not null
      order by data_hora
      limit 1;

      v_viagem_id := null;

      insert into pedagio.viagem_transporte (
        numero_transporte, veiculo_id, placa_informada, cidade_origem, uf_origem,
        cidade_destino, uf_destino, data_hora_saida, data_hora_chegada,
        carreta1, carreta2, tipo_viagem, embarcador_id, lote_importacao_id
      ) values (
        trim(v_row.numero_transporte), v_veiculo_id, v_row.placa, v_row.cidade_origem, v_row.uf_origem,
        v_row.cidade_destino, v_row.uf_destino, v_saida, v_chegada,
        v_row.carreta1, v_row.carreta2, v_tipo_viagem, v_embarcador_id, v_lote_id
      )
      on conflict (numero_transporte) do nothing
      returning id into v_viagem_id;

      if not found then
        v_erros := v_erros + 1;
      else
        perform pedagio.revalidar_passagens_da_viagem(v_viagem_id);
      end if;
    exception when others then
      v_erros := v_erros + 1;
    end;
  end loop;

  update pedagio.lote_importacao set total_linhas = v_total, total_erros = v_erros where id = v_lote_id;

  delete from pedagio.staging_viagem_transporte where id = any(v_ids);

  select * into v_lote from pedagio.lote_importacao where id = v_lote_id;
  return v_lote;
end;
$function$;
