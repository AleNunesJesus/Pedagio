-- Correção da FASE 22: obter_ou_criar_*_importacao exigia usuário logado
-- no app (auth.uid()), então a importação rodada direto no banco (SQL Editor
-- / script, sem JWT — fluxo descrito em docs/importacao.md) virava erro em
-- toda linha de passagem/estacionamento. Corpo igual ao da FASE 22, só a
-- checagem de autorização muda. Grants (revoke de public/anon) são mantidos
-- pelo create or replace.

create or replace function pedagio.obter_ou_criar_praca_importacao(p_nome text, p_sentido text, p_lote_id uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id uuid;
begin
  -- pela API (PostgREST, session_user = authenticator) exige usuário
  -- autorizado ou service_role; conexão direta ao banco (SQL Editor, script)
  -- já é confiável e não tem JWT
  if session_user = 'authenticator'
    and coalesce(auth.role(), '') <> 'service_role'
    and not pedagio.usuario_autorizado() then
    raise exception 'usuario nao autorizado';
  end if;

  if p_nome is null or trim(p_nome) = '' then
    return null;
  end if;

  -- duas importações simultâneas com a mesma praça nova não duplicam o cadastro
  perform pg_advisory_xact_lock(hashtext('pedagio.praca:' || upper(trim(p_nome)) || '|' || upper(trim(coalesce(p_sentido, '')))));

  select id into v_id
  from pedagio.praca_pedagio
  where upper(trim(nome)) = upper(trim(p_nome))
    and upper(trim(coalesce(sentido, ''))) = upper(trim(coalesce(p_sentido, '')))
  order by created_at
  limit 1;

  if v_id is null then
    insert into pedagio.praca_pedagio (nome, sentido, cadastro_pendente, criada_no_lote_id)
    values (trim(p_nome), nullif(trim(p_sentido), ''), true, p_lote_id)
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

create or replace function pedagio.obter_ou_criar_estacionamento_importacao(p_nome text, p_lote_id uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id uuid;
begin
  -- pela API (PostgREST, session_user = authenticator) exige usuário
  -- autorizado ou service_role; conexão direta ao banco (SQL Editor, script)
  -- já é confiável e não tem JWT
  if session_user = 'authenticator'
    and coalesce(auth.role(), '') <> 'service_role'
    and not pedagio.usuario_autorizado() then
    raise exception 'usuario nao autorizado';
  end if;

  if p_nome is null or trim(p_nome) = '' then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtext('pedagio.estacionamento:' || upper(trim(p_nome))));

  select id into v_id
  from pedagio.estacionamento
  where upper(trim(nome)) = upper(trim(p_nome))
  order by created_at
  limit 1;

  if v_id is null then
    insert into pedagio.estacionamento (nome, cadastro_pendente, criada_no_lote_id)
    values (trim(p_nome), true, p_lote_id)
    returning id into v_id;
  end if;

  return v_id;
end;
$$;
