-- FASE 09: carga em lote de posições de GPS (posicao_veiculo), no mesmo
-- padrão de staging + função da importação de passagens (FASE 04/07).

-- Evita duplicar pings ao reprocessar o mesmo arquivo por engano.
alter table pedagio.posicao_veiculo
  add constraint posicao_veiculo_veiculo_data_hora_uniq unique (veiculo_id, data_hora);

create table pedagio.staging_posicao_veiculo (
  id bigint generated always as identity primary key,
  placa text,
  latitude_texto text,
  longitude_texto text,
  data_texto text,
  horario_texto text,
  criado_em timestamptz not null default now()
);

alter table pedagio.staging_posicao_veiculo enable row level security;

create policy acesso_autorizados on pedagio.staging_posicao_veiculo
  for all using (pedagio.usuario_autorizado()) with check (pedagio.usuario_autorizado());

-- posicao_veiculo passa a aceitar INSERT de qualquer autorizado (antes só
-- admin, quando ainda não existia UI de carga de GPS).
drop policy insercao_admin on pedagio.posicao_veiculo;
create policy insercao_autorizados on pedagio.posicao_veiculo for insert with check (pedagio.usuario_autorizado());

create or replace function pedagio.parse_coordenada(p_texto text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_limpo text := trim(p_texto);
begin
  if v_limpo is null or v_limpo = '' then
    return null;
  end if;
  return v_limpo::numeric;
exception when others then
  return null;
end;
$$;

-- Nota: a definição abaixo já foi substituída pela migration seguinte
-- (20260911171616_pedagio_fix_tipo_lote_posicoes_gps.sql), que corrige
-- o valor de `tipo` usado em lote_importacao (era 'posicoes', o check
-- constraint da FASE 02 exige 'posicoes_gps'). Mantida aqui só por
-- fidelidade ao que foi de fato aplicado nesta migration.
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
  values ('posicoes', p_arquivo_nome, p_usuario, array_length(v_ids, 1), 0)
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
      -- diferente de passagem_pedagio, aqui não existe "sem_cadastro":
      -- veiculo_id é obrigatório, então uma placa não cadastrada não tem
      -- como ser armazenada e conta como erro do lote.
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
      -- ping duplicado (mesmo veículo + mesmo horário já importado antes)
      v_erros := v_erros + 1;
    end if;
  end loop;

  update pedagio.lote_importacao set total_linhas = v_total, total_erros = v_erros where id = v_lote_id;

  delete from pedagio.staging_posicao_veiculo where id = any(v_ids);

  select * into v_lote from pedagio.lote_importacao where id = v_lote_id;
  return v_lote;
end;
$$;
