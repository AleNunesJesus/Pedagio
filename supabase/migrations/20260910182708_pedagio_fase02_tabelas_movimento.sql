-- FASE 02: tabelas de movimento (lote_importacao, posicao_veiculo, passagem_pedagio, validacao_passagem)

create table pedagio.lote_importacao (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('passagens', 'posicoes_gps')),
  arquivo_nome text,
  usuario text,
  total_linhas int,
  total_erros int,
  created_at timestamptz not null default now()
);

alter table pedagio.lote_importacao enable row level security;

-- posicao_veiculo: pings de GPS. fonte distingue carga em lote vs API (FASE atual só usa carga em lote).
create table pedagio.posicao_veiculo (
  id bigserial primary key,
  veiculo_id uuid not null references pedagio.veiculo(id),
  geom extensions.geometry(Point, 4326) not null,
  data_hora timestamptz not null,
  fonte text not null check (fonte in ('carga_arquivo', 'api')),
  lote_importacao_id uuid references pedagio.lote_importacao(id),
  created_at timestamptz not null default now()
);

create index posicao_veiculo_geom_gist on pedagio.posicao_veiculo using gist (geom);
create index posicao_veiculo_veiculo_data_idx on pedagio.posicao_veiculo (veiculo_id, data_hora);
create index posicao_veiculo_lote_idx on pedagio.posicao_veiculo (lote_importacao_id);

alter table pedagio.posicao_veiculo enable row level security;

-- passagem_pedagio: uma linha da planilha importada.
-- veiculo_id/praca_id ficam nulos quando placa/praca informada não bate com cadastro (decisão de
-- bloquear vs. importar como sem_cadastro fica para a FASE 04); status_validacao 'sem_cadastro'
-- já previsto no check para não exigir migration extra depois.
create table pedagio.passagem_pedagio (
  id uuid primary key default gen_random_uuid(),
  id_externo text,
  veiculo_id uuid references pedagio.veiculo(id),
  placa_informada text not null,
  praca_id uuid references pedagio.praca_pedagio(id),
  praca_informada text not null,
  data_hora timestamptz not null,
  valor_cobrado numeric(10,2) not null check (valor_cobrado >= 0),
  documento_vinculado text,
  lote_importacao_id uuid not null references pedagio.lote_importacao(id),
  status_validacao text not null default 'pendente' check (
    status_validacao in ('pendente', 'ok', 'sem_dados_gps', 'fora_poligono', 'valor_divergente', 'local_e_valor_divergentes', 'sem_cadastro')
  ),
  created_at timestamptz not null default now()
);

create index passagem_pedagio_veiculo_data_idx on pedagio.passagem_pedagio (veiculo_id, data_hora);
create index passagem_pedagio_praca_idx on pedagio.passagem_pedagio (praca_id);
create index passagem_pedagio_lote_idx on pedagio.passagem_pedagio (lote_importacao_id);
create index passagem_pedagio_status_idx on pedagio.passagem_pedagio (status_validacao);

alter table pedagio.passagem_pedagio enable row level security;

-- validacao_passagem: resultado do cruzamento geoespacial + tarifário (1:1 com passagem_pedagio).
create table pedagio.validacao_passagem (
  id uuid primary key default gen_random_uuid(),
  passagem_id uuid not null unique references pedagio.passagem_pedagio(id),
  posicao_veiculo_id bigint references pedagio.posicao_veiculo(id),
  dentro_poligono boolean,
  distancia_metros numeric,
  diferenca_segundos int,
  valor_esperado numeric(10,2),
  divergencia_valor numeric(10,2),
  resultado text not null check (
    resultado in ('ok', 'sem_dados_gps', 'fora_poligono', 'valor_divergente', 'local_e_valor_divergentes')
  ),
  validado_em timestamptz not null default now()
);

create index validacao_passagem_posicao_idx on pedagio.validacao_passagem (posicao_veiculo_id);

alter table pedagio.validacao_passagem enable row level security;
