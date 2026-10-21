-- FASE 22: praça/estacionamento não cadastrado na importação da fatura
-- passa a ser criado automaticamente com os dados da planilha (nome +
-- sentido) e marcado como cadastro pendente, em vez de deixar a passagem
-- órfã (praca_id nulo) para sempre. Ao completar o cadastro (polígono) as
-- passagens vinculadas são revalidadas; idem ao gravar/alterar tarifa.

-- 1) colunas: polígono passa a ser opcional só enquanto o cadastro estiver pendente
alter table pedagio.praca_pedagio
  alter column poligono drop not null,
  add column cadastro_pendente boolean not null default false,
  add column criada_no_lote_id uuid references pedagio.lote_importacao(id) on delete set null,
  add constraint praca_pedagio_poligono_ou_pendente_check check (poligono is not null or cadastro_pendente);

alter table pedagio.estacionamento
  alter column poligono drop not null,
  add column cadastro_pendente boolean not null default false,
  add column criada_no_lote_id uuid references pedagio.lote_importacao(id) on delete set null,
  add constraint estacionamento_poligono_ou_pendente_check check (poligono is not null or cadastro_pendente);

create index praca_pedagio_criada_no_lote_id_idx on pedagio.praca_pedagio (criada_no_lote_id);
create index estacionamento_criada_no_lote_id_idx on pedagio.estacionamento (criada_no_lote_id);

-- 2) busca-ou-cria usado pela importação. SECURITY DEFINER porque a
-- inserção em praca_pedagio/estacionamento é admin-only (RLS), mas qualquer
-- usuário autorizado importa planilha. Mesma regra de casamento que a
-- importação já usava (nome + sentido, sem diferenciar maiúsculas/espaços).
create or replace function pedagio.obter_ou_criar_praca_importacao(p_nome text, p_sentido text, p_lote_id uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id uuid;
begin
  if not pedagio.usuario_autorizado() then
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
  if not pedagio.usuario_autorizado() then
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

-- 3) vincula passagens órfãs (sem praça) que batem com o cadastro e revalida
-- todas as passagens da praça. Chamado ao criar/atualizar a praça.
create or replace function pedagio.revalidar_passagens_da_praca(p_praca_id uuid)
returns integer
language plpgsql
set search_path to ''
as $$
declare
  v_praca pedagio.praca_pedagio;
  v_id uuid;
  v_count int := 0;
begin
  select * into v_praca from pedagio.praca_pedagio where id = p_praca_id;
  if not found then
    return 0;
  end if;

  update pedagio.passagem_pedagio set praca_id = p_praca_id
  where praca_id is null
    and tipo_uso <> 'estacionamento'
    and upper(trim(praca_informada)) = upper(trim(v_praca.nome))
    and upper(trim(coalesce(sentido_informado, ''))) = upper(trim(coalesce(v_praca.sentido, '')));

  for v_id in
    select id from pedagio.passagem_pedagio
    where praca_id = p_praca_id and tipo_uso = 'passagem'
  loop
    perform pedagio.validar_passagem(v_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function pedagio.revalidar_passagens_do_estacionamento(p_estacionamento_id uuid)
returns integer
language plpgsql
set search_path to ''
as $$
declare
  v_estacionamento pedagio.estacionamento;
  v_id uuid;
  v_count int := 0;
begin
  select * into v_estacionamento from pedagio.estacionamento where id = p_estacionamento_id;
  if not found then
    return 0;
  end if;

  update pedagio.passagem_pedagio set estacionamento_id = p_estacionamento_id
  where estacionamento_id is null
    and tipo_uso = 'estacionamento'
    and upper(trim(praca_informada)) = upper(trim(v_estacionamento.nome));

  for v_id in
    select id from pedagio.passagem_pedagio
    where estacionamento_id = p_estacionamento_id and tipo_uso = 'estacionamento'
  loop
    perform pedagio.validar_estacionamento(v_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- 3b) importação usa o busca-ou-cria (resto do corpo igual à versão ativa)
CREATE OR REPLACE FUNCTION pedagio.processar_staging_passagens(p_arquivo_nome text DEFAULT NULL::text, p_usuario text DEFAULT NULL::text)
 RETURNS pedagio.lote_importacao
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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

      -- FASE 22: praça/estacionamento não cadastrado é criado com os dados da
      -- planilha e fica como cadastro pendente (ver obter_ou_criar_*_importacao)
      if v_tipo_uso = 'estacionamento' then
        v_estacionamento_id := pedagio.obter_ou_criar_estacionamento_importacao(v_row.praca_nome, v_lote_id);
      else
        v_praca_id := pedagio.obter_ou_criar_praca_importacao(v_row.praca_nome, v_row.sentido, v_lote_id);
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

-- 3c) validação: praça/estacionamento sem polígono = sem_cadastro (resto igual à versão ativa)
CREATE OR REPLACE FUNCTION pedagio.validar_passagem(p_passagem_id uuid)
 RETURNS pedagio.validacao_passagem
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_passagem pedagio.passagem_pedagio;
  v_janela interval := pedagio.janela_tolerancia_validacao();
  v_posicao pedagio.posicao_veiculo;
  v_tarifa numeric(10,2);
  v_resultado text;
  v_dentro boolean;
  v_distancia numeric;
  v_diferenca int;
  v_divergencia numeric;
  v_validacao pedagio.validacao_passagem;
  v_categoria_id uuid;
  v_origem_categoria text;
  v_viagem_transporte_id uuid;
  v_vinculo_viagem_status text;
  v_viagem_transporte_candidatas int;
  v_numero_viagem_bate boolean;
begin
  select * into v_passagem from pedagio.passagem_pedagio where id = p_passagem_id;
  if not found then
    raise exception 'passagem % nao encontrada', p_passagem_id;
  end if;

  -- FASE 22: praça criada automaticamente pela importação ainda sem polígono
  -- também é sem_cadastro (não dá pra validar local nem tarifa ainda)
  if v_passagem.veiculo_id is null or v_passagem.praca_id is null
    or not exists (select 1 from pedagio.praca_pedagio pp where pp.id = v_passagem.praca_id and pp.poligono is not null) then
    update pedagio.passagem_pedagio set status_validacao = 'sem_cadastro' where id = p_passagem_id;
    return null;
  end if;

  select pv.* into v_posicao
  from pedagio.posicao_veiculo pv
  join pedagio.praca_pedagio pp on pp.id = v_passagem.praca_id
  where pv.veiculo_id = v_passagem.veiculo_id
    and pv.data_hora between v_passagem.data_hora - v_janela and v_passagem.data_hora + v_janela
    and extensions.ST_Contains(pp.poligono, pv.geom)
  order by abs(extract(epoch from pv.data_hora - v_passagem.data_hora))
  limit 1;

  if found then
    v_dentro := true;
    v_diferenca := extract(epoch from (v_posicao.data_hora - v_passagem.data_hora))::int;
    v_distancia := 0;
  else
    select pv.* into v_posicao
    from pedagio.posicao_veiculo pv
    where pv.veiculo_id = v_passagem.veiculo_id
      and pv.data_hora between v_passagem.data_hora - v_janela and v_passagem.data_hora + v_janela
    order by abs(extract(epoch from pv.data_hora - v_passagem.data_hora))
    limit 1;

    if found then
      v_dentro := false;
      v_diferenca := extract(epoch from (v_posicao.data_hora - v_passagem.data_hora))::int;
      select extensions.ST_Distance(pp.poligono::extensions.geography, v_posicao.geom::extensions.geography)
      into v_distancia
      from pedagio.praca_pedagio pp where pp.id = v_passagem.praca_id;
    else
      v_dentro := null;
      v_diferenca := null;
      v_distancia := null;
    end if;
  end if;

  v_categoria_id := pedagio.categoria_por_composicao(v_passagem.placa_informada, v_passagem.data_hora);
  if v_categoria_id is not null then
    v_origem_categoria := 'composicao_viagem';
  else
    select categoria_fallback_id into v_categoria_id from pedagio.veiculo where id = v_passagem.veiculo_id;
    v_origem_categoria := 'cadastro_veiculo';
  end if;

  select tp.valor into v_tarifa
  from pedagio.tarifa_praca tp
  where tp.praca_id = v_passagem.praca_id
    and tp.categoria_veiculo_id = v_categoria_id
    and tp.vigencia_inicio <= (v_passagem.data_hora at time zone 'America/Sao_Paulo')::date
    and (tp.vigencia_fim is null or tp.vigencia_fim >= (v_passagem.data_hora at time zone 'America/Sao_Paulo')::date);

  if v_tarifa is not null then
    v_divergencia := v_passagem.valor_cobrado - v_tarifa;
  else
    v_divergencia := null;
  end if;

  -- vínculo com viagem_transporte: placa + janela saída/chegada (mesma
  -- heurística da FASE 13/19). Mais de uma candidata -> ambíguo, não
  -- resolve sozinho.
  select count(*) into v_viagem_transporte_candidatas
  from pedagio.viagem_transporte vt
  where upper(trim(vt.placa_informada)) = upper(trim(v_passagem.placa_informada))
    and v_passagem.data_hora between vt.data_hora_saida and vt.data_hora_chegada;

  if v_viagem_transporte_candidatas = 0 then
    v_viagem_transporte_id := null;
    v_vinculo_viagem_status := 'sem_vinculo';
  elsif v_viagem_transporte_candidatas = 1 then
    select vt.id into v_viagem_transporte_id
    from pedagio.viagem_transporte vt
    where upper(trim(vt.placa_informada)) = upper(trim(v_passagem.placa_informada))
      and v_passagem.data_hora between vt.data_hora_saida and vt.data_hora_chegada;
    v_vinculo_viagem_status := 'vinculado';
  else
    v_viagem_transporte_id := null;
    v_vinculo_viagem_status := 'ambiguo';
  end if;

  if v_vinculo_viagem_status = 'vinculado'
    and v_passagem.viagem_informada is not null and trim(v_passagem.viagem_informada) <> '' then
    select upper(trim(vt.numero_transporte)) = upper(trim(v_passagem.viagem_informada))
    into v_numero_viagem_bate
    from pedagio.viagem_transporte vt
    where vt.id = v_viagem_transporte_id;
  else
    v_numero_viagem_bate := null;
  end if;

  if v_posicao.id is null then
    v_resultado := 'sem_dados_gps';
  elsif v_dentro and (v_divergencia is null or v_divergencia = 0) then
    v_resultado := 'ok';
  elsif v_dentro then
    v_resultado := 'valor_divergente';
  elsif v_divergencia is null or v_divergencia = 0 then
    v_resultado := 'fora_poligono';
  else
    v_resultado := 'local_e_valor_divergentes';
  end if;

  insert into pedagio.validacao_passagem (
    passagem_id, posicao_veiculo_id, dentro_poligono, distancia_metros,
    diferenca_segundos, valor_esperado, divergencia_valor, resultado, validado_em,
    categoria_veiculo_id, origem_categoria,
    viagem_transporte_id, vinculo_viagem_status, viagem_transporte_candidatas, numero_viagem_bate
  ) values (
    p_passagem_id, v_posicao.id, v_dentro, v_distancia,
    v_diferenca, v_tarifa, v_divergencia, v_resultado, now(),
    v_categoria_id, v_origem_categoria,
    v_viagem_transporte_id, v_vinculo_viagem_status, v_viagem_transporte_candidatas, v_numero_viagem_bate
  )
  on conflict (passagem_id) do update set
    posicao_veiculo_id = excluded.posicao_veiculo_id,
    dentro_poligono = excluded.dentro_poligono,
    distancia_metros = excluded.distancia_metros,
    diferenca_segundos = excluded.diferenca_segundos,
    valor_esperado = excluded.valor_esperado,
    divergencia_valor = excluded.divergencia_valor,
    resultado = excluded.resultado,
    validado_em = now(),
    categoria_veiculo_id = excluded.categoria_veiculo_id,
    origem_categoria = excluded.origem_categoria,
    viagem_transporte_id = excluded.viagem_transporte_id,
    vinculo_viagem_status = excluded.vinculo_viagem_status,
    viagem_transporte_candidatas = excluded.viagem_transporte_candidatas,
    numero_viagem_bate = excluded.numero_viagem_bate
  returning * into v_validacao;

  update pedagio.passagem_pedagio set status_validacao = v_resultado where id = p_passagem_id;

  return v_validacao;
end;
$function$;

CREATE OR REPLACE FUNCTION pedagio.validar_estacionamento(p_passagem_id uuid)
 RETURNS pedagio.validacao_estacionamento
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_passagem pedagio.passagem_pedagio;
  v_estacionamento pedagio.estacionamento;
  v_janela_busca interval := pedagio.janela_busca_estacionamento();
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

  if v_passagem.veiculo_id is null or v_passagem.estacionamento_id is null
    or not exists (select 1 from pedagio.estacionamento e where e.id = v_passagem.estacionamento_id and e.poligono is not null) then
    update pedagio.passagem_pedagio set status_validacao = 'sem_cadastro' where id = p_passagem_id;
    return null;
  end if;

  select * into v_estacionamento from pedagio.estacionamento where id = v_passagem.estacionamento_id;

  with dentro as (
    select pv.data_hora
    from pedagio.posicao_veiculo pv
    where pv.veiculo_id = v_passagem.veiculo_id
      and pv.data_hora between v_passagem.data_hora - v_janela_busca and v_passagem.data_hora + v_janela_busca
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
$function$;

-- 4) criar/atualizar praça: mesmo corpo de antes + revalidação; salvar pelo
-- formulário (que exige polígono) é o que encerra o cadastro pendente
create or replace function pedagio.criar_praca(p_nome text, p_poligono_geojson jsonb, p_rodovia text DEFAULT NULL::text, p_concessionaria text DEFAULT NULL::text, p_km numeric DEFAULT NULL::numeric, p_sentido text DEFAULT NULL::text, p_ativo boolean DEFAULT true)
 RETURNS pedagio.praca_pedagio
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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

  perform pedagio.revalidar_passagens_da_praca(v_praca.id);

  return v_praca;
end;
$function$;

create or replace function pedagio.atualizar_praca(p_id uuid, p_nome text, p_poligono_geojson jsonb, p_rodovia text DEFAULT NULL::text, p_concessionaria text DEFAULT NULL::text, p_km numeric DEFAULT NULL::numeric, p_sentido text DEFAULT NULL::text, p_ativo boolean DEFAULT true)
 RETURNS pedagio.praca_pedagio
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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

create or replace function pedagio.criar_estacionamento(p_nome text, p_poligono_geojson jsonb, p_ativo boolean DEFAULT true)
 RETURNS pedagio.estacionamento
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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

  perform pedagio.revalidar_passagens_do_estacionamento(v_estacionamento.id);

  return v_estacionamento;
end;
$function$;

create or replace function pedagio.atualizar_estacionamento(p_id uuid, p_nome text, p_poligono_geojson jsonb, p_ativo boolean DEFAULT true)
 RETURNS pedagio.estacionamento
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
    ativo = p_ativo,
    cadastro_pendente = false
  where id = p_id
  returning * into v_estacionamento;

  if not found then
    raise exception 'estacionamento % nao encontrado', p_id;
  end if;

  perform pedagio.revalidar_passagens_do_estacionamento(v_estacionamento.id);

  return v_estacionamento;
end;
$function$;

-- 5) gravar/alterar/excluir tarifa revalida as passagens afetadas (antes
-- uma tarifa cadastrada depois da importação nunca chegava nas passagens
-- já validadas sem tarifa de referência)
create or replace function pedagio.trg_revalidar_passagens_por_tarifa_praca()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_id uuid;
begin
  for v_id in
    select pp.id
    from pedagio.passagem_pedagio pp
    where pp.tipo_uso = 'passagem'
      and (
        (tg_op <> 'DELETE'
          and pp.praca_id = new.praca_id
          and (pp.data_hora at time zone 'America/Sao_Paulo')::date >= new.vigencia_inicio
          and (new.vigencia_fim is null or (pp.data_hora at time zone 'America/Sao_Paulo')::date <= new.vigencia_fim))
        or (tg_op <> 'INSERT'
          and pp.praca_id = old.praca_id
          and (pp.data_hora at time zone 'America/Sao_Paulo')::date >= old.vigencia_inicio
          and (old.vigencia_fim is null or (pp.data_hora at time zone 'America/Sao_Paulo')::date <= old.vigencia_fim))
      )
  loop
    perform pedagio.validar_passagem(v_id);
  end loop;

  return null;
end;
$$;

create trigger tarifa_praca_revalidar_passagens
after insert or update or delete on pedagio.tarifa_praca
for each row execute function pedagio.trg_revalidar_passagens_por_tarifa_praca();

-- estacionamento: a tarifa é escolhida pela data de entrada detectada (não
-- pela data da passagem), então revalida tudo do estacionamento — volume
-- pequeno
create or replace function pedagio.trg_revalidar_passagens_por_tarifa_estacionamento()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_id uuid;
begin
  for v_id in
    select pp.id
    from pedagio.passagem_pedagio pp
    where pp.tipo_uso = 'estacionamento'
      and pp.estacionamento_id in (
        case when tg_op <> 'DELETE' then new.estacionamento_id end,
        case when tg_op <> 'INSERT' then old.estacionamento_id end
      )
  loop
    perform pedagio.validar_estacionamento(v_id);
  end loop;

  return null;
end;
$$;

create trigger tarifa_estacionamento_revalidar_passagens
after insert or update or delete on pedagio.tarifa_estacionamento
for each row execute function pedagio.trg_revalidar_passagens_por_tarifa_estacionamento();

-- 6) excluir lote também remove praças/estacionamentos que ele criou
-- automaticamente e que continuam pendentes e sem uso
create or replace function pedagio.excluir_lote_importacao(p_lote_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_ids_posicao bigint[];
  v_ids_viagem uuid[];
begin
  if not pedagio.eh_admin() then
    raise exception 'apenas administradores podem excluir lotes de importação';
  end if;

  delete from pedagio.passagem_pedagio where lote_importacao_id = p_lote_id;

  select array_agg(id) into v_ids_posicao
  from pedagio.posicao_veiculo where lote_importacao_id = p_lote_id;
  if v_ids_posicao is not null then
    perform pedagio.excluir_posicoes(v_ids_posicao);
  end if;

  select array_agg(id) into v_ids_viagem
  from pedagio.viagem_transporte where lote_importacao_id = p_lote_id;
  if v_ids_viagem is not null then
    perform pedagio.excluir_viagens_transporte(v_ids_viagem);
  end if;

  delete from pedagio.praca_pedagio p
  where p.criada_no_lote_id = p_lote_id
    and p.cadastro_pendente
    and not exists (select 1 from pedagio.passagem_pedagio pp where pp.praca_id = p.id)
    and not exists (select 1 from pedagio.tarifa_praca tp where tp.praca_id = p.id);

  delete from pedagio.estacionamento e
  where e.criada_no_lote_id = p_lote_id
    and e.cadastro_pendente
    and not exists (select 1 from pedagio.passagem_pedagio pp where pp.estacionamento_id = e.id)
    and not exists (select 1 from pedagio.tarifa_estacionamento te where te.estacionamento_id = e.id);

  delete from pedagio.lote_importacao where id = p_lote_id;
end;
$function$;

-- 7) views de mapa: colunas novas anexadas ao final (restrição do Postgres)
create or replace view pedagio.vw_praca_pedagio_mapa with (security_invoker = true) as
 SELECT id,
    nome,
    rodovia,
    concessionaria,
    km,
    extensions.st_asgeojson(poligono)::json AS poligono_geojson,
    sentido,
    ativo,
    created_at,
    cadastro_pendente,
    criada_no_lote_id
   FROM pedagio.praca_pedagio;

create or replace view pedagio.vw_estacionamento_mapa with (security_invoker = true) as
 SELECT id,
    nome,
    extensions.st_asgeojson(poligono)::json AS poligono_geojson,
    ativo,
    created_at,
    cadastro_pendente,
    criada_no_lote_id
   FROM pedagio.estacionamento;
