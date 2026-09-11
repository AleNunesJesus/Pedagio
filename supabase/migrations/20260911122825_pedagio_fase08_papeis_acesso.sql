-- FASE 08: papéis de acesso (admin/operador) — substitui as policies
-- authenticated_full_access (true/true) por controle real por papel.

create table pedagio.usuario_perfil (
  user_id uuid primary key references auth.users(id) on delete cascade,
  papel text not null check (papel in ('admin', 'operador')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table pedagio.usuario_perfil enable row level security;

-- Helpers (SECURITY DEFINER: leem usuario_perfil independente da RLS de
-- quem chama, sem expor a tabela diretamente a não-admins).

create or replace function pedagio.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from pedagio.usuario_perfil
    where user_id = auth.uid() and papel = 'admin'
  );
$$;

create or replace function pedagio.usuario_autorizado()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from pedagio.usuario_perfil
    where user_id = auth.uid()
  );
$$;

create or replace function pedagio.meu_papel()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select papel from pedagio.usuario_perfil where user_id = auth.uid();
$$;

-- RPCs de gestão (admin-only, verificado dentro da própria função).

create or replace function pedagio.listar_usuarios()
returns table (user_id uuid, email text, papel text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not pedagio.eh_admin() then
    raise exception 'apenas administradores podem listar usuários';
  end if;

  return query
    select u.id, u.email::text, up.papel
    from auth.users u
    left join pedagio.usuario_perfil up on up.user_id = u.id
    order by u.email;
end;
$$;

create or replace function pedagio.definir_papel(p_user_id uuid, p_papel text)
returns pedagio.usuario_perfil
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row pedagio.usuario_perfil;
begin
  if not pedagio.eh_admin() then
    raise exception 'apenas administradores podem definir papéis';
  end if;

  if p_papel not in ('admin', 'operador') then
    raise exception 'papel inválido: %', p_papel;
  end if;

  insert into pedagio.usuario_perfil (user_id, papel)
  values (p_user_id, p_papel)
  on conflict (user_id) do update
    set papel = excluded.papel, atualizado_em = now()
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function pedagio.remover_papel(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not pedagio.eh_admin() then
    raise exception 'apenas administradores podem remover papéis';
  end if;

  delete from pedagio.usuario_perfil where user_id = p_user_id;
end;
$$;

-- RLS de usuario_perfil: só admin toca a tabela diretamente (frontend usa
-- as RPCs acima; a leitura do próprio papel é via meu_papel()).
create policy usuario_perfil_admin_all
  on pedagio.usuario_perfil
  for all
  using (pedagio.eh_admin())
  with check (pedagio.eh_admin());

-- Cadastros: leitura para qualquer autorizado, escrita só admin.
drop policy authenticated_full_access on pedagio.categoria_veiculo;
create policy leitura_autorizados on pedagio.categoria_veiculo for select using (pedagio.usuario_autorizado());
create policy insercao_admin on pedagio.categoria_veiculo for insert with check (pedagio.eh_admin());
create policy atualizacao_admin on pedagio.categoria_veiculo for update using (pedagio.eh_admin()) with check (pedagio.eh_admin());
create policy exclusao_admin on pedagio.categoria_veiculo for delete using (pedagio.eh_admin());

drop policy authenticated_full_access on pedagio.praca_pedagio;
create policy leitura_autorizados on pedagio.praca_pedagio for select using (pedagio.usuario_autorizado());
create policy insercao_admin on pedagio.praca_pedagio for insert with check (pedagio.eh_admin());
create policy atualizacao_admin on pedagio.praca_pedagio for update using (pedagio.eh_admin()) with check (pedagio.eh_admin());
create policy exclusao_admin on pedagio.praca_pedagio for delete using (pedagio.eh_admin());

drop policy authenticated_full_access on pedagio.tarifa_praca;
create policy leitura_autorizados on pedagio.tarifa_praca for select using (pedagio.usuario_autorizado());
create policy insercao_admin on pedagio.tarifa_praca for insert with check (pedagio.eh_admin());
create policy atualizacao_admin on pedagio.tarifa_praca for update using (pedagio.eh_admin()) with check (pedagio.eh_admin());
create policy exclusao_admin on pedagio.tarifa_praca for delete using (pedagio.eh_admin());

drop policy authenticated_full_access on pedagio.veiculo;
create policy leitura_autorizados on pedagio.veiculo for select using (pedagio.usuario_autorizado());
create policy insercao_admin on pedagio.veiculo for insert with check (pedagio.eh_admin());
create policy atualizacao_admin on pedagio.veiculo for update using (pedagio.eh_admin()) with check (pedagio.eh_admin());
create policy exclusao_admin on pedagio.veiculo for delete using (pedagio.eh_admin());

-- Staging/importação: operacional, liberado por completo a qualquer
-- autorizado (é o fluxo que o operador precisa usar).
drop policy authenticated_full_access on pedagio.staging_passagem_pedagio;
create policy acesso_autorizados on pedagio.staging_passagem_pedagio for all using (pedagio.usuario_autorizado()) with check (pedagio.usuario_autorizado());

-- lote_importacao: autorizados leem/criam/atualizam (necessário para o
-- fluxo de importação); exclusão só admin.
drop policy authenticated_full_access on pedagio.lote_importacao;
create policy leitura_autorizados on pedagio.lote_importacao for select using (pedagio.usuario_autorizado());
create policy insercao_autorizados on pedagio.lote_importacao for insert with check (pedagio.usuario_autorizado());
create policy atualizacao_autorizados on pedagio.lote_importacao for update using (pedagio.usuario_autorizado()) with check (pedagio.usuario_autorizado());
create policy exclusao_admin on pedagio.lote_importacao for delete using (pedagio.eh_admin());

-- passagem_pedagio / validacao_passagem: idem — o motor de validação
-- (SECURITY INVOKER) roda como quem chamou a importação, então operador
-- precisa de insert/update aqui também. Exclusão só admin.
drop policy authenticated_full_access on pedagio.passagem_pedagio;
create policy leitura_autorizados on pedagio.passagem_pedagio for select using (pedagio.usuario_autorizado());
create policy insercao_autorizados on pedagio.passagem_pedagio for insert with check (pedagio.usuario_autorizado());
create policy atualizacao_autorizados on pedagio.passagem_pedagio for update using (pedagio.usuario_autorizado()) with check (pedagio.usuario_autorizado());
create policy exclusao_admin on pedagio.passagem_pedagio for delete using (pedagio.eh_admin());

drop policy authenticated_full_access on pedagio.validacao_passagem;
create policy leitura_autorizados on pedagio.validacao_passagem for select using (pedagio.usuario_autorizado());
create policy insercao_autorizados on pedagio.validacao_passagem for insert with check (pedagio.usuario_autorizado());
create policy atualizacao_autorizados on pedagio.validacao_passagem for update using (pedagio.usuario_autorizado()) with check (pedagio.usuario_autorizado());
create policy exclusao_admin on pedagio.validacao_passagem for delete using (pedagio.eh_admin());

-- posicao_veiculo: sem UI de carga de GPS ainda — leitura para
-- autorizados, escrita restrita a admin por ora (revisar quando a
-- importação de GPS existir).
drop policy authenticated_full_access on pedagio.posicao_veiculo;
create policy leitura_autorizados on pedagio.posicao_veiculo for select using (pedagio.usuario_autorizado());
create policy insercao_admin on pedagio.posicao_veiculo for insert with check (pedagio.eh_admin());
create policy atualizacao_admin on pedagio.posicao_veiculo for update using (pedagio.eh_admin()) with check (pedagio.eh_admin());
create policy exclusao_admin on pedagio.posicao_veiculo for delete using (pedagio.eh_admin());
