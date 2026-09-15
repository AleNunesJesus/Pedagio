-- FASE 20: cadastro de estacionamento (pernoite/período) + validação de
-- permanência via GPS. Decisões fechadas com o usuário em 2026-09-15 (ver
-- docs/ROADMAP.md): novo valor de tipo_uso_texto na mesma planilha de
-- passagens (uma linha só, sem par entrada/saída); cadastro com polígono
-- geográfico igual praca_pedagio; tarifa por diária com vigência igual
-- tarifa_praca; diária = ceil(duração/24h); gap de continuidade entre
-- pings dentro do polígono = 6h; janela de busca do início da permanência
-- = 30 dias antes da data_hora de referência.

-- 1) parâmetros isolados em função (mesmo padrão de janela_tolerancia_validacao,
-- FASE 03) para não duplicar valores mágicos e facilitar ajuste futuro.
create function pedagio.janela_busca_estacionamento()
returns interval
language sql
immutable
as $$
  select interval '30 days'
$$;

create function pedagio.gap_continuidade_estacionamento()
returns interval
language sql
immutable
as $$
  select interval '6 hours'
$$;

-- 2) cadastro de estacionamento (igual praca_pedagio, sem "sentido")
create table pedagio.estacionamento (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  poligono extensions.geometry(Polygon, 4326) not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create index estacionamento_poligono_gist on pedagio.estacionamento using gist (poligono);

alter table pedagio.estacionamento enable row level security;

-- 3) tarifa por diária, com vigência (mesma trava de sobreposição de tarifa_praca)
create table pedagio.tarifa_estacionamento (
  id uuid primary key default gen_random_uuid(),
  estacionamento_id uuid not null references pedagio.estacionamento(id),
  valor_diaria numeric(10,2) not null check (valor_diaria >= 0),
  vigencia_inicio date not null,
  vigencia_fim date,
  created_at timestamptz not null default now(),
  constraint tarifa_estacionamento_vigencia_valida check (vigencia_fim is null or vigencia_fim >= vigencia_inicio),
  constraint tarifa_estacionamento_sem_sobreposicao exclude using gist (
    estacionamento_id with =,
    daterange(vigencia_inicio, coalesce(vigencia_fim, 'infinity'::date), '[]') with &&
  )
);

create index tarifa_estacionamento_estacionamento_id_idx on pedagio.tarifa_estacionamento (estacionamento_id);

alter table pedagio.tarifa_estacionamento enable row level security;

-- 4) passagem_pedagio: novo tipo_uso + FK pro estacionamento reconhecido
alter table pedagio.passagem_pedagio drop constraint passagem_pedagio_tipo_uso_check;
alter table pedagio.passagem_pedagio add constraint passagem_pedagio_tipo_uso_check
  check (tipo_uso in ('passagem', 'contrato', 'estacionamento'));

alter table pedagio.passagem_pedagio add column estacionamento_id uuid references pedagio.estacionamento(id);
create index passagem_pedagio_estacionamento_id_idx on pedagio.passagem_pedagio (estacionamento_id);

-- 5) resultado da validação de permanência — tabela própria (não reaproveita
-- validacao_passagem: campos são conceitualmente diferentes, permanência num
-- período vs. ponto único no tempo)
create table pedagio.validacao_estacionamento (
  id uuid primary key default gen_random_uuid(),
  passagem_id uuid not null unique references pedagio.passagem_pedagio(id) on delete cascade,
  entrada_detectada timestamptz,
  saida_detectada timestamptz,
  diarias_detectadas integer,
  tarifa_diaria_aplicada numeric(10,2),
  valor_esperado numeric(10,2),
  divergencia_valor numeric(10,2),
  resultado text not null check (resultado in ('ok', 'sem_dados_gps', 'valor_divergente')),
  validado_em timestamptz not null default now()
);

alter table pedagio.validacao_estacionamento enable row level security;

-- 6) normalizar_tipo_uso ganha o rótulo provisório "ESTACIONAMENTO" (sem
-- arquivo real do fornecedor ainda pra confirmar o rótulo exato — mesmo
-- padrão da FASE 07, revisar quando o arquivo real chegar)
create or replace function pedagio.normalizar_tipo_uso(p_texto text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_norm text := translate(upper(trim(coalesce(p_texto, ''))), 'ÁÀÂÃÉÊÍÓÔÕÚÇ', 'AAAAEEIOOOUC');
begin
  if v_norm in ('PASSAGEM', 'PASSAGENS') then
    return 'passagem';
  elsif v_norm in ('CONTRATO', 'PLANO CONTRATADO') then
    return 'contrato';
  elsif v_norm = 'ESTACIONAMENTO' then
    return 'estacionamento';
  else
    return null;
  end if;
end;
$$;

-- 7) função de validação de permanência: acha, via GPS, a "corrida" contínua
-- (gap <= 6h) de pings dentro do polígono do estacionamento mais próxima/
-- relevante à data_hora de referência da linha, deriva diárias e compara o
-- valor esperado (diárias x tarifa vigente) contra o valor cobrado. Detecção
-- de corridas via "gaps and islands" (sum() de flag de novo grupo sobre lag()),
-- sem loop procedural.
create function pedagio.validar_estacionamento(p_passagem_id uuid)
returns pedagio.validacao_estacionamento
language plpgsql
set search_path = ''
as $$
declare
  v_passagem pedagio.passagem_pedagio;
  v_estacionamento pedagio.estacionamento;
  v_janela_busca interval := pedagio.janela_busca_estacionamento();
  v_janela_pos interval := pedagio.janela_tolerancia_validacao();
  v_gap interval := pedagio.gap_continuidade_estacionamento();
  v_entrada timestamptz;
  v_saida timestamptz;
  v_diarias int;
  v_tarifa numeric(10,2);
  v_valor_esperado numeric(10,2);
  v_divergencia numeric(10,2);
  v_resultado text;
  v_validacao pedagio.validacao_estacionamento;
begin
  select * into v_passagem from pedagio.passagem_pedagio where id = p_passagem_id;
  if not found then
    raise exception 'passagem % nao encontrada', p_passagem_id;
  end if;

  if v_passagem.veiculo_id is null or v_passagem.estacionamento_id is null then
    update pedagio.passagem_pedagio set status_validacao = 'sem_cadastro' where id = p_passagem_id;
    return null;
  end if;

  select * into v_estacionamento from pedagio.estacionamento where id = v_passagem.estacionamento_id;

  with dentro as (
    select pv.data_hora
    from pedagio.posicao_veiculo pv
    where pv.veiculo_id = v_passagem.veiculo_id
      and pv.data_hora between v_passagem.data_hora - v_janela_busca and v_passagem.data_hora + v_janela_pos
      and extensions.ST_Contains(v_estacionamento.poligono, pv.geom)
  ),
  marcado as (
    select data_hora,
      (lag(data_hora) over (order by data_hora) is null
        or data_hora - lag(data_hora) over (order by data_hora) > v_gap) as novo_run
    from dentro
  ),
  grupos as (
    select data_hora, sum(case when novo_run then 1 else 0 end) over (order by data_hora) as grp
    from marcado
  ),
  corridas as (
    select grp, min(data_hora) as entrada, max(data_hora) as saida
    from grupos
    group by grp
  )
  select entrada, saida into v_entrada, v_saida
  from corridas
  order by
    case when v_passagem.data_hora between entrada and saida then 0 else 1 end,
    abs(extract(epoch from saida - v_passagem.data_hora))
  limit 1;

  if v_entrada is null then
    v_resultado := 'sem_dados_gps';
    v_diarias := null;
    v_tarifa := null;
    v_valor_esperado := null;
    v_divergencia := null;
  else
    v_diarias := greatest(1, ceil(extract(epoch from (v_saida - v_entrada)) / 86400.0)::int);

    select te.valor_diaria into v_tarifa
    from pedagio.tarifa_estacionamento te
    where te.estacionamento_id = v_estacionamento.id
      and te.vigencia_inicio <= (v_entrada at time zone 'America/Sao_Paulo')::date
      and (te.vigencia_fim is null or te.vigencia_fim >= (v_entrada at time zone 'America/Sao_Paulo')::date);

    if v_tarifa is not null then
      v_valor_esperado := v_diarias * v_tarifa;
      v_divergencia := v_passagem.valor_cobrado - v_valor_esperado;
    else
      -- sem tarifa vigente cadastrada: mesma simplificação de tarifa_praca (FASE 03)
      v_valor_esperado := null;
      v_divergencia := null;
    end if;

    if v_divergencia is null or v_divergencia = 0 then
      v_resultado := 'ok';
    else
      v_resultado := 'valor_divergente';
    end if;
  end if;

  insert into pedagio.validacao_estacionamento (
    passagem_id, entrada_detectada, saida_detectada, diarias_detectadas,
    tarifa_diaria_aplicada, valor_esperado, divergencia_valor, resultado, validado_em
  ) values (
    p_passagem_id, v_entrada, v_saida, v_diarias,
    v_tarifa, v_valor_esperado, v_divergencia, v_resultado, now()
  )
  on conflict (passagem_id) do update set
    entrada_detectada = excluded.entrada_detectada,
    saida_detectada = excluded.saida_detectada,
    diarias_detectadas = excluded.diarias_detectadas,
    tarifa_diaria_aplicada = excluded.tarifa_diaria_aplicada,
    valor_esperado = excluded.valor_esperado,
    divergencia_valor = excluded.divergencia_valor,
    resultado = excluded.resultado,
    validado_em = now()
  returning * into v_validacao;

  update pedagio.passagem_pedagio set status_validacao = v_resultado where id = p_passagem_id;

  return v_validacao;
end;
$$;

-- 8) processar_validacoes_pendentes passa a rotear por tipo_uso
create or replace function pedagio.processar_validacoes_pendentes()
returns int
language plpgsql
set search_path = ''
as $$
declare
  v_row record;
  v_count int := 0;
begin
  for v_row in
    select id, tipo_uso from pedagio.passagem_pedagio
    where status_validacao in ('pendente', 'sem_dados_gps') and tipo_uso in ('passagem', 'estacionamento')
  loop
    if v_row.tipo_uso = 'estacionamento' then
      perform pedagio.validar_estacionamento(v_row.id);
    else
      perform pedagio.validar_passagem(v_row.id);
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- 9) revalidação automática ao chegar GPS novo: passagens tipo_uso=estacionamento
-- usam a janela de busca de 30 dias (bem maior que a janela pontual de passagem)
create or replace function pedagio.trg_revalidar_passagens_por_posicao()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_janela interval := pedagio.janela_tolerancia_validacao();
  v_janela_busca interval := pedagio.janela_busca_estacionamento();
  v_id uuid;
begin
  for v_id in
    select pp.id
    from pedagio.passagem_pedagio pp
    where pp.veiculo_id = new.veiculo_id
      and pp.tipo_uso = 'passagem'
      and pp.status_validacao in ('pendente', 'sem_dados_gps')
      and pp.data_hora between new.data_hora - v_janela and new.data_hora + v_janela
  loop
    perform pedagio.validar_passagem(v_id);
  end loop;

  for v_id in
    select pp.id
    from pedagio.passagem_pedagio pp
    where pp.veiculo_id = new.veiculo_id
      and pp.tipo_uso = 'estacionamento'
      and pp.status_validacao in ('pendente', 'sem_dados_gps')
      and pp.data_hora between new.data_hora - v_janela_busca and new.data_hora + v_janela
  loop
    perform pedagio.validar_estacionamento(v_id);
  end loop;

  return new;
end;
$$;

-- 10) importação: casa tipo_uso='estacionamento' contra pedagio.estacionamento
-- (reaproveita a coluna praca_nome, sem usar sentido) em vez de praca_pedagio
create or replace function pedagio.processar_staging_passagens(p_arquivo_nome text DEFAULT NULL::text, p_usuario text DEFAULT NULL::text)
returns pedagio.lote_importacao
language plpgsql
set search_path to ''
as $function$
declare
  v_lote_id uuid;
  v_ids bigint[];
  v_row record;
  v_total int := 0;
  v_erros int := 0;
  v_data_hora timestamptz;
  v_valor numeric(10,2);
  v_tipo_uso text;
  v_condicao text;
  v_veiculo_id uuid;
  v_praca_id uuid;
  v_estacionamento_id uuid;
  v_viagem_id uuid;
  v_embarcador_id uuid;
  v_status text;
  v_lote pedagio.lote_importacao;
begin
  select array_agg(id) into v_ids from pedagio.staging_passagem_pedagio;
  if v_ids is null then
    raise exception 'pedagio.staging_passagem_pedagio esta vazia, nada para importar';
  end if;

  insert into pedagio.lote_importacao (tipo, arquivo_nome, usuario, total_linhas, total_erros)
  values ('passagens', p_arquivo_nome, p_usuario, array_length(v_ids, 1), 0)
  returning id into v_lote_id;

  for v_row in select * from pedagio.staging_passagem_pedagio where id = any(v_ids) order by id loop
    v_total := v_total + 1;

    begin
      v_data_hora := pedagio.parse_data_hora_planilha(v_row.data_texto, v_row.horario_texto);
      v_valor := pedagio.parse_valor_brl(v_row.valor_texto);
      v_tipo_uso := pedagio.normalizar_tipo_uso(v_row.tipo_uso_texto);
      v_condicao := pedagio.normalizar_condicao(v_row.condicao_texto);

      if v_data_hora is null or v_valor is null or v_tipo_uso is null or v_condicao is null
        or v_row.praca_nome is null or trim(v_row.praca_nome) = ''
        or (v_tipo_uso <> 'estacionamento' and (v_row.sentido is null or trim(v_row.sentido) = '')) then
        v_erros := v_erros + 1;
        continue;
      end if;

      v_valor := case when v_condicao = 'debito' then abs(v_valor) else -abs(v_valor) end;

      select id into v_veiculo_id from pedagio.veiculo where tipo = 'cavalo' and upper(trim(placa)) = upper(trim(v_row.placa)) limit 1;

      v_praca_id := null;
      v_estacionamento_id := null;

      if v_tipo_uso = 'estacionamento' then
        select id into v_estacionamento_id
        from pedagio.estacionamento
        where upper(trim(nome)) = upper(trim(coalesce(v_row.praca_nome, '')))
        limit 1;
      else
        select id into v_praca_id
        from pedagio.praca_pedagio
        where upper(trim(nome)) = upper(trim(coalesce(v_row.praca_nome, '')))
          and upper(trim(coalesce(sentido, ''))) = upper(trim(coalesce(v_row.sentido, '')))
        limit 1;
      end if;

      v_viagem_id := null;
      if v_row.viagem is not null and trim(v_row.viagem) <> '' then
        insert into pedagio.viagem (numero) values (trim(v_row.viagem))
        on conflict (numero) do nothing;
        select id into v_viagem_id from pedagio.viagem where numero = trim(v_row.viagem);
      end if;

      v_embarcador_id := null;
      if v_row.embarcador is not null and trim(v_row.embarcador) <> '' then
        insert into pedagio.embarcador (nome) values (trim(v_row.embarcador))
        on conflict (nome) do nothing;
        select id into v_embarcador_id from pedagio.embarcador where upper(nome) = upper(trim(v_row.embarcador));
      end if;

      v_status := case when v_tipo_uso = 'contrato' then 'nao_aplicavel' else 'pendente' end;

      insert into pedagio.passagem_pedagio (
        numero_fatura, veiculo_id, placa_informada, tipo_veiculo_informado,
        praca_id, praca_informada, sentido_informado, tipo_uso, condicao,
        data_hora, valor_cobrado, viagem_informada, viagem_id, embarcador_informada, embarcador_id,
        estacionamento_id, lote_importacao_id, status_validacao
      ) values (
        v_row.numero_fatura, v_veiculo_id, v_row.placa, v_row.tipo_veiculo,
        v_praca_id, v_row.praca_nome, v_row.sentido, v_tipo_uso, v_condicao,
        v_data_hora, v_valor, v_row.viagem, v_viagem_id, v_row.embarcador, v_embarcador_id,
        v_estacionamento_id, v_lote_id, v_status
      )
      on conflict (placa_informada, data_hora, condicao, valor_cobrado) do nothing;

      if not found then
        v_erros := v_erros + 1;
      end if;
    exception when others then
      v_erros := v_erros + 1;
    end;
  end loop;

  update pedagio.lote_importacao set total_linhas = v_total, total_erros = v_erros where id = v_lote_id;

  delete from pedagio.staging_passagem_pedagio where id = any(v_ids);

  perform pedagio.processar_validacoes_pendentes();

  select * into v_lote from pedagio.lote_importacao where id = v_lote_id;
  return v_lote;
end;
$function$;

-- 11) leitura do polígono como GeoJSON (mesmo padrão de vw_praca_pedagio_mapa)
-- + RPCs de escrita (GeoJSON -> geometry), mesmo padrão de criar_praca/atualizar_praca
create view pedagio.vw_estacionamento_mapa
with (security_invoker = true)
as
select
  id,
  nome,
  extensions.ST_AsGeoJSON(poligono)::json as poligono_geojson,
  ativo,
  created_at
from pedagio.estacionamento;

create function pedagio.criar_estacionamento(
  p_nome text,
  p_poligono_geojson jsonb,
  p_ativo boolean default true
)
returns pedagio.estacionamento
language plpgsql
set search_path = ''
as $$
declare
  v_geom extensions.geometry;
  v_estacionamento pedagio.estacionamento;
begin
  v_geom := extensions.ST_GeomFromGeoJSON(p_poligono_geojson::text);

  if extensions.GeometryType(v_geom) <> 'POLYGON' then
    raise exception 'poligono precisa ser um Polygon (recebido: %)', extensions.GeometryType(v_geom);
  end if;

  if not extensions.ST_IsValid(v_geom) then
    raise exception 'poligono invalido (self-intersecting ou similar)';
  end if;

  insert into pedagio.estacionamento (nome, poligono, ativo)
  values (p_nome, extensions.ST_SetSRID(v_geom, 4326), p_ativo)
  returning * into v_estacionamento;

  return v_estacionamento;
end;
$$;

create function pedagio.atualizar_estacionamento(
  p_id uuid,
  p_nome text,
  p_poligono_geojson jsonb,
  p_ativo boolean default true
)
returns pedagio.estacionamento
language plpgsql
set search_path = ''
as $$
declare
  v_geom extensions.geometry;
  v_estacionamento pedagio.estacionamento;
begin
  v_geom := extensions.ST_GeomFromGeoJSON(p_poligono_geojson::text);

  if extensions.GeometryType(v_geom) <> 'POLYGON' then
    raise exception 'poligono precisa ser um Polygon (recebido: %)', extensions.GeometryType(v_geom);
  end if;

  if not extensions.ST_IsValid(v_geom) then
    raise exception 'poligono invalido (self-intersecting ou similar)';
  end if;

  update pedagio.estacionamento set
    nome = p_nome,
    poligono = extensions.ST_SetSRID(v_geom, 4326),
    ativo = p_ativo
  where id = p_id
  returning * into v_estacionamento;

  if not found then
    raise exception 'estacionamento % nao encontrado', p_id;
  end if;

  return v_estacionamento;
end;
$$;

-- 12) exclusão admin-only (mesmo padrão de excluir_pracas/excluir_tarifas)
create function pedagio.excluir_estacionamentos(p_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not pedagio.eh_admin() then
    raise exception 'apenas administradores podem excluir estacionamentos';
  end if;

  delete from pedagio.estacionamento where id = any(p_ids);
end;
$$;

create function pedagio.excluir_tarifas_estacionamento(p_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not pedagio.eh_admin() then
    raise exception 'apenas administradores podem excluir tarifas de estacionamento';
  end if;

  delete from pedagio.tarifa_estacionamento where id = any(p_ids);
end;
$$;

-- 13) RLS (mesmo padrão de praca_pedagio/tarifa_praca/validacao_passagem, FASE 08):
-- cadastros = leitura autorizado / escrita admin; validação = leitura+insert+update
-- autorizado (motor SECURITY INVOKER roda como quem importou) / exclusão admin.
create policy leitura_autorizados on pedagio.estacionamento for select using (pedagio.usuario_autorizado());
create policy insercao_admin on pedagio.estacionamento for insert with check (pedagio.eh_admin());
create policy atualizacao_admin on pedagio.estacionamento for update using (pedagio.eh_admin()) with check (pedagio.eh_admin());
create policy exclusao_admin on pedagio.estacionamento for delete using (pedagio.eh_admin());

create policy leitura_autorizados on pedagio.tarifa_estacionamento for select using (pedagio.usuario_autorizado());
create policy insercao_admin on pedagio.tarifa_estacionamento for insert with check (pedagio.eh_admin());
create policy atualizacao_admin on pedagio.tarifa_estacionamento for update using (pedagio.eh_admin()) with check (pedagio.eh_admin());
create policy exclusao_admin on pedagio.tarifa_estacionamento for delete using (pedagio.eh_admin());

create policy leitura_autorizados on pedagio.validacao_estacionamento for select using (pedagio.usuario_autorizado());
create policy insercao_autorizados on pedagio.validacao_estacionamento for insert with check (pedagio.usuario_autorizado());
create policy atualizacao_autorizados on pedagio.validacao_estacionamento for update using (pedagio.usuario_autorizado()) with check (pedagio.usuario_autorizado());
create policy exclusao_admin on pedagio.validacao_estacionamento for delete using (pedagio.eh_admin());
