-- lote_importacao.tipo já tinha um check constraint desde a FASE 02
-- restringindo a 'passagens'/'posicoes_gps' — a função usava 'posicoes'
-- por engano.
create or replace function pedagio.processar_staging_posicoes(p_arquivo_nome text default null::text, p_usuario text default null::text)
returns pedagio.lote_importacao
language plpgsql
set search_path = ''
as $$
declare
  v_lote_id uuid;
  v_ids bigint[];
  v_row record;
  v_total int := 0;
  v_erros int := 0;
  v_data_hora timestamptz;
  v_lat numeric;
  v_lon numeric;
  v_veiculo_id uuid;
  v_lote pedagio.lote_importacao;
begin
  select array_agg(id) into v_ids from pedagio.staging_posicao_veiculo;
  if v_ids is null then
    raise exception 'pedagio.staging_posicao_veiculo esta vazia, nada para importar';
  end if;

  insert into pedagio.lote_importacao (tipo, arquivo_nome, usuario, total_linhas, total_erros)
  values ('posicoes_gps', p_arquivo_nome, p_usuario, array_length(v_ids, 1), 0)
  returning id into v_lote_id;

  for v_row in select * from pedagio.staging_posicao_veiculo where id = any(v_ids) order by id loop
    v_total := v_total + 1;

    v_data_hora := pedagio.parse_data_hora_planilha(v_row.data_texto, v_row.horario_texto);
    v_lat := pedagio.parse_coordenada(v_row.latitude_texto);
    v_lon := pedagio.parse_coordenada(v_row.longitude_texto);

    if v_data_hora is null or v_lat is null or v_lon is null
       or v_lat < -90 or v_lat > 90 or v_lon < -180 or v_lon > 180 then
      v_erros := v_erros + 1;
      continue;
    end if;

    select id into v_veiculo_id from pedagio.veiculo where upper(trim(placa)) = upper(trim(v_row.placa)) limit 1;

    if v_veiculo_id is null then
      v_erros := v_erros + 1;
      continue;
    end if;

    insert into pedagio.posicao_veiculo (veiculo_id, geom, data_hora, fonte, lote_importacao_id)
    values (
      v_veiculo_id,
      extensions.ST_SetSRID(extensions.ST_MakePoint(v_lon, v_lat), 4326),
      v_data_hora,
      'carga_arquivo',
      v_lote_id
    )
    on conflict (veiculo_id, data_hora) do nothing;

    if not found then
      v_erros := v_erros + 1;
    end if;
  end loop;

  update pedagio.lote_importacao set total_linhas = v_total, total_erros = v_erros where id = v_lote_id;

  delete from pedagio.staging_posicao_veiculo where id = any(v_ids);

  select * into v_lote from pedagio.lote_importacao where id = v_lote_id;
  return v_lote;
end;
$$;
