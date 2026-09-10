-- FASE 01: schema base e tabelas de cadastro do projeto Pedagio

create schema if not exists pedagio;

create extension if not exists postgis with schema extensions;
create extension if not exists btree_gist with schema extensions;

-- categoria_veiculo
create table pedagio.categoria_veiculo (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  descricao text not null,
  created_at timestamptz not null default now()
);

alter table pedagio.categoria_veiculo enable row level security;

-- praca_pedagio
create table pedagio.praca_pedagio (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  rodovia text,
  concessionaria text,
  km numeric,
  poligono extensions.geometry(Polygon, 4326) not null,
  sentido text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create index praca_pedagio_poligono_gist on pedagio.praca_pedagio using gist (poligono);

alter table pedagio.praca_pedagio enable row level security;

-- tarifa_praca (histórico de tarifas por praça + categoria, sem sobreposição de vigência)
create table pedagio.tarifa_praca (
  id uuid primary key default gen_random_uuid(),
  praca_id uuid not null references pedagio.praca_pedagio(id),
  categoria_veiculo_id uuid not null references pedagio.categoria_veiculo(id),
  valor numeric(10,2) not null check (valor >= 0),
  vigencia_inicio date not null,
  vigencia_fim date,
  created_at timestamptz not null default now(),
  constraint tarifa_praca_vigencia_valida check (vigencia_fim is null or vigencia_fim >= vigencia_inicio),
  constraint tarifa_praca_sem_sobreposicao exclude using gist (
    praca_id with =,
    categoria_veiculo_id with =,
    daterange(vigencia_inicio, coalesce(vigencia_fim, 'infinity'::date), '[]') with &&
  )
);

create index tarifa_praca_praca_categoria_idx on pedagio.tarifa_praca (praca_id, categoria_veiculo_id);

alter table pedagio.tarifa_praca enable row level security;

-- veiculo
create table pedagio.veiculo (
  id uuid primary key default gen_random_uuid(),
  placa text not null unique,
  categoria_veiculo_id uuid not null references pedagio.categoria_veiculo(id),
  frota text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table pedagio.veiculo enable row level security;
