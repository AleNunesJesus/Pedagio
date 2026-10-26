-- FASE 27 (fix): pela API o bloco falhava com "UPDATE requires a WHERE
-- clause" — o PostgREST carrega a extensão safeupdate na sessão do
-- authenticator, que bloqueia UPDATE/DELETE sem WHERE (mesmo em tabela
-- temporária). O ensaio da 20261024210000 rodou por conexão direta, onde a
-- extensão não é carregada. O motivo de erro passa a ser calculado no próprio
-- INSERT da tabela temporária, sem o UPDATE. Bloco padrão sobe para 3.000
-- (arquivo real: 4,7 milhões de linhas).

create or replace function pedagio.processar_bloco_posicoes(p_lote_id uuid, p_limite integer default 3000)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_total int;
  v_inseridas int;
  v_motivos jsonb;
  v_erros int;
  v_restantes int;
begin
  if session_user = 'authenticator'
    and coalesce(auth.role(), '') <> 'service_role'
    and not pedagio.usuario_autorizado() then
    raise exception 'usuario nao autorizado';
  end if;

  if not exists (select 1 from pedagio.lote_importacao where id = p_lote_id and tipo = 'posicoes_gps') then
    raise exception 'lote de posicoes % nao encontrado', p_lote_id;
  end if;

  perform set_config('pedagio.gps_em_lote', 'on', true);

  create temp table if not exists pg_temp.bloco_gps (
    id bigint, veiculo_id uuid, data_hora timestamptz, lat numeric, lon numeric, motivo text
  ) on commit drop;
  truncate pg_temp.bloco_gps;

  insert into pg_temp.bloco_gps (id, veiculo_id, data_hora, lat, lon, motivo)
  select p.id, p.veiculo_id, p.data_hora, p.lat, p.lon,
         case
           when p.data_hora is null then 'Data/hora inválida'
           when p.lat is null or p.lon is null or p.lat < -90 or p.lat > 90 or p.lon < -180 or p.lon > 180
             then 'Coordenada inválida'
           when p.veiculo_id is null then 'Placa não cadastrada como cavalo mecânico'
         end
  from (
    select s.id, v.id veiculo_id,
           pedagio.parse_data_hora_planilha(s.data_texto, s.horario_texto) data_hora,
           pedagio.parse_coordenada(s.latitude_texto) lat,
           pedagio.parse_coordenada(s.longitude_texto) lon
    from (
      select * from pedagio.staging_posicao_veiculo
      where lote_id = p_lote_id
      order by id
      limit greatest(coalesce(p_limite, 3000), 1)
    ) s
    left join lateral (
      select ve.id from pedagio.veiculo ve
      where ve.tipo = 'cavalo' and upper(trim(ve.placa)) = upper(trim(s.placa))
      limit 1
    ) v on true
  ) p;

  insert into pedagio.posicao_veiculo (veiculo_id, geom, data_hora, fonte, lote_importacao_id)
  select veiculo_id, extensions.ST_SetSRID(extensions.ST_MakePoint(lon, lat), 4326), data_hora, 'carga_arquivo', p_lote_id
  from pg_temp.bloco_gps
  where motivo is null
  on conflict (veiculo_id, data_hora) do nothing;
  get diagnostics v_inseridas = row_count;

  select count(*) into v_total from pg_temp.bloco_gps;

  select coalesce(jsonb_object_agg(motivo, qtd), '{}'::jsonb) into v_motivos
  from (
    select motivo, count(*) qtd from pg_temp.bloco_gps where motivo is not null group by motivo
    union all
    -- válidas que não entraram: mesmo veículo e horário já gravados (ou repetidas no bloco)
    select 'Posição repetida (mesmo veículo e horário)', (count(*) - v_inseridas)
    from pg_temp.bloco_gps where motivo is null
    having count(*) - v_inseridas > 0
  ) m;
  v_erros := v_total - v_inseridas;

  delete from pedagio.staging_posicao_veiculo s using pg_temp.bloco_gps b where s.id = b.id;

  update pedagio.lote_importacao l set
    total_linhas = coalesce(l.total_linhas, 0) + v_total,
    total_erros = coalesce(l.total_erros, 0) + v_erros,
    erros_por_motivo = (
      select coalesce(jsonb_object_agg(k, coalesce((l.erros_por_motivo->>k)::int, 0) + coalesce((v_motivos->>k)::int, 0)), '{}'::jsonb)
      from (select jsonb_object_keys(coalesce(l.erros_por_motivo, '{}'::jsonb) || v_motivos) k) chaves
    )
  where l.id = p_lote_id;

  select count(*) into v_restantes from pedagio.staging_posicao_veiculo where lote_id = p_lote_id;

  return jsonb_build_object('processadas', v_total, 'erros', v_erros, 'restantes', v_restantes, 'erros_por_motivo', v_motivos);
end;
$function$;
