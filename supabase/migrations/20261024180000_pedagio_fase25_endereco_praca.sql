-- FASE 25: endereço da praça (endereço livre + município + UF).
-- Campos opcionais, preenchidos pela busca "Localizar no mapa" do cadastro
-- (Nominatim) e editáveis. Não entram no casamento da importação — a chave
-- continua sendo nome + sentido.

alter table pedagio.praca_pedagio
  add column endereco text,
  add column municipio text,
  add column uf char(2) check (uf in (
    'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB',
    'PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'
  ));

create index praca_pedagio_uf_idx on pedagio.praca_pedagio (uf);

-- colunas novas no fim (create or replace view não reordena colunas)
create or replace view pedagio.vw_praca_pedagio_mapa
with (security_invoker = true) as
select
  id,
  nome,
  rodovia,
  concessionaria,
  km,
  extensions.st_asgeojson(poligono)::json as poligono_geojson,
  sentido,
  ativo,
  created_at,
  cadastro_pendente,
  criada_no_lote_id,
  endereco,
  municipio,
  uf
from pedagio.praca_pedagio;

-- assinatura muda (parâmetros novos): remove a antiga para não deixar duas
-- sobrecargas ambíguas com defaults
drop function pedagio.criar_praca(text, jsonb, text, text, numeric, text, boolean);
drop function pedagio.atualizar_praca(uuid, text, jsonb, text, text, numeric, text, boolean);

create function pedagio.criar_praca(
  p_nome text,
  p_poligono_geojson jsonb,
  p_rodovia text default null,
  p_concessionaria text default null,
  p_km numeric default null,
  p_sentido text default null,
  p_ativo boolean default true,
  p_endereco text default null,
  p_municipio text default null,
  p_uf text default null
)
returns pedagio.praca_pedagio
language plpgsql
set search_path to ''
as $function$
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

  insert into pedagio.praca_pedagio (nome, rodovia, concessionaria, km, poligono, sentido, ativo, endereco, municipio, uf)
  values (
    p_nome, p_rodovia, p_concessionaria, p_km,
    extensions.ST_SetSRID(v_geom, 4326), p_sentido, p_ativo,
    nullif(btrim(p_endereco), ''), nullif(btrim(p_municipio), ''), nullif(upper(btrim(p_uf)), '')
  )
  returning * into v_praca;

  perform pedagio.revalidar_passagens_da_praca(v_praca.id);

  return v_praca;
end;
$function$;

create function pedagio.atualizar_praca(
  p_id uuid,
  p_nome text,
  p_poligono_geojson jsonb,
  p_rodovia text default null,
  p_concessionaria text default null,
  p_km numeric default null,
  p_sentido text default null,
  p_ativo boolean default true,
  p_endereco text default null,
  p_municipio text default null,
  p_uf text default null
)
returns pedagio.praca_pedagio
language plpgsql
set search_path to ''
as $function$
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
    ativo = p_ativo,
    endereco = nullif(btrim(p_endereco), ''),
    municipio = nullif(btrim(p_municipio), ''),
    uf = nullif(upper(btrim(p_uf)), ''),
    cadastro_pendente = false
  where id = p_id
  returning * into v_praca;

  if not found then
    raise exception 'praca % nao encontrada', p_id;
  end if;

  perform pedagio.revalidar_passagens_da_praca(v_praca.id);

  return v_praca;
end;
$function$;

revoke execute on function pedagio.criar_praca(text, jsonb, text, text, numeric, text, boolean, text, text, text) from public, anon;
revoke execute on function pedagio.atualizar_praca(uuid, text, jsonb, text, text, numeric, text, boolean, text, text, text) from public, anon;
grant execute on function pedagio.criar_praca(text, jsonb, text, text, numeric, text, boolean, text, text, text) to authenticated, service_role;
grant execute on function pedagio.atualizar_praca(uuid, text, jsonb, text, text, numeric, text, boolean, text, text, text) to authenticated, service_role;

-- Instantâneo das cabines de pedágio e pórticos free flow do OpenStreetMap
-- (barrier=toll_booth / highway=toll_gantry), carregado por script — o
-- Overpass público levava ~30 s por consulta, inviável no cadastro. O mapa
-- da praça mostra as cabines da área visível e cria um polígono inicial em
-- volta da escolhida. Dados © colaboradores do OpenStreetMap (ODbL).
create table pedagio.cabine_osm (
  osm_id bigint primary key,
  tipo text not null check (tipo in ('cabine', 'free_flow')),
  nome text,
  operadora text,
  tarifa text,
  -- sentido de circulação em graus (tag direction), 0 = norte
  rumo numeric(5,1) check (rumo >= 0 and rumo < 360),
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  uf char(2),
  osm_conferido_em date,
  carregado_em timestamptz not null default now()
);

create index cabine_osm_lat_lon_idx on pedagio.cabine_osm (lat, lon);

alter table pedagio.cabine_osm enable row level security;

create policy leitura_autorizados on pedagio.cabine_osm for select using ((select pedagio.usuario_autorizado()));
create policy insercao_admin on pedagio.cabine_osm for insert with check ((select pedagio.eh_admin()));
create policy atualizacao_admin on pedagio.cabine_osm for update using ((select pedagio.eh_admin())) with check ((select pedagio.eh_admin()));
create policy exclusao_admin on pedagio.cabine_osm for delete using ((select pedagio.eh_admin()));
