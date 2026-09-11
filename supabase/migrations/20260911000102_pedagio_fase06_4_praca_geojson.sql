-- FASE 06.4: view de leitura + funções de escrita para converter entre GeoJSON
-- (o que o Leaflet produz/consome nativamente) e geometry (o que o Postgres/PostGIS
-- usa). O frontend nunca lida com WKB hex diretamente.

create view pedagio.vw_praca_pedagio_mapa
with (security_invoker = true)
as
select
  id,
  nome,
  rodovia,
  concessionaria,
  km,
  extensions.ST_AsGeoJSON(poligono)::json as poligono_geojson,
  sentido,
  ativo,
  created_at
from pedagio.praca_pedagio;

create function pedagio.criar_praca(
  p_nome text,
  p_poligono_geojson jsonb,
  p_rodovia text default null,
  p_concessionaria text default null,
  p_km numeric default null,
  p_sentido text default null,
  p_ativo boolean default true
)
returns pedagio.praca_pedagio
language plpgsql
as $$
declare
  v_geom extensions.geometry;
  v_praca pedagio.praca_pedagio;
begin
  v_geom := extensions.ST_GeomFromGeoJSON(p_poligono_geojson::text);

  if extensions.GeometryType(v_geom) <> 'POLYGON' then
    raise exception 'poligono precisa ser um Polygon (recebido: %)', extensions.GeometryType(v_geom);
  end if;

  if not extensions.ST_IsValid(v_geom) then
    raise exception 'poligono invalido (self-intersecting ou similar)';
  end if;

  insert into pedagio.praca_pedagio (nome, rodovia, concessionaria, km, poligono, sentido, ativo)
  values (
    p_nome, p_rodovia, p_concessionaria, p_km,
    extensions.ST_SetSRID(v_geom, 4326), p_sentido, p_ativo
  )
  returning * into v_praca;

  return v_praca;
end;
$$;

create function pedagio.atualizar_praca(
  p_id uuid,
  p_nome text,
  p_poligono_geojson jsonb,
  p_rodovia text default null,
  p_concessionaria text default null,
  p_km numeric default null,
  p_sentido text default null,
  p_ativo boolean default true
)
returns pedagio.praca_pedagio
language plpgsql
as $$
declare
  v_geom extensions.geometry;
  v_praca pedagio.praca_pedagio;
begin
  v_geom := extensions.ST_GeomFromGeoJSON(p_poligono_geojson::text);

  if extensions.GeometryType(v_geom) <> 'POLYGON' then
    raise exception 'poligono precisa ser um Polygon (recebido: %)', extensions.GeometryType(v_geom);
  end if;

  if not extensions.ST_IsValid(v_geom) then
    raise exception 'poligono invalido (self-intersecting ou similar)';
  end if;

  update pedagio.praca_pedagio set
    nome = p_nome,
    rodovia = p_rodovia,
    concessionaria = p_concessionaria,
    km = p_km,
    poligono = extensions.ST_SetSRID(v_geom, 4326),
    sentido = p_sentido,
    ativo = p_ativo
  where id = p_id
  returning * into v_praca;

  if not found then
    raise exception 'praca % nao encontrada', p_id;
  end if;

  return v_praca;
end;
$$;

alter function pedagio.criar_praca(text, jsonb, text, text, numeric, text, boolean) set search_path = '';
alter function pedagio.atualizar_praca(uuid, text, jsonb, text, text, numeric, text, boolean) set search_path = '';
