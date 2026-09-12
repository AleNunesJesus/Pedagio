create table pedagio.carreta (
  id uuid primary key default gen_random_uuid(),
  placa text not null unique,
  tipo text not null check (tipo in ('comum', 'vanderleia')),
  created_at timestamptz not null default now()
);

alter table pedagio.carreta enable row level security;

create policy leitura_autorizados on pedagio.carreta
  for select using (pedagio.usuario_autorizado());

create policy insercao_admin on pedagio.carreta
  for insert with check (pedagio.eh_admin());

create policy atualizacao_admin on pedagio.carreta
  for update using (pedagio.eh_admin()) with check (pedagio.eh_admin());

create policy exclusao_admin on pedagio.carreta
  for delete using (pedagio.eh_admin());
