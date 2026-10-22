-- FASE 23: importação da fatura real de um mês (34.536 linhas, 4,4 MB).
-- 1) Processamento em blocos: o app envia ~500 linhas por chamada (limite
--    de 1 MB do Server Action e statement_timeout de 8 s do papel
--    authenticated); staging ganha lote_id e cada bloco processa só as
--    linhas daquele lote. processar_staging_passagens (caminho manual via
--    SQL) vira um laço sobre o mesmo processar_bloco_passagens.
-- 2) Erros por motivo acumulados no lote (lote_importacao.erros_por_motivo).
-- 3) Tipos de uso novos da fatura real: ADESÃO, OUTRAS TAXAS e CRÉDITO PLANO
--    CONTRATADO — um tipo para cada (decisão do usuário), sem praça,
--    status nao_aplicavel.
-- 4) Crédito de vale-pedágio sem Descrição (PASSAGENS/CR com viagem e
--    embarcador) entra sem praça, status nao_aplicavel — inclusive em
--    revalidações posteriores (regra dentro de validar_passagem).
-- 5) Passagem sem Sentido da Praça é aceita e reconhecida pela Descrição
--    (que já traz o sentido embutido, ex. "SP310, KM181+500, NORTE, RIO CLARO").
-- 6) Linhas 100% idênticas dentro do mesmo arquivo (144 créditos de
--    vale-pedágio na fatura real) são créditos distintos (decisão do usuário):
--    cada repetição ganha um número de ocorrência, que entra na trava de
--    duplicidade — reimportar o mesmo arquivo continua não duplicando.

-- 1) tipos de uso
alter table pedagio.passagem_pedagio drop constraint passagem_pedagio_tipo_uso_check;
alter table pedagio.passagem_pedagio add constraint passagem_pedagio_tipo_uso_check
  check (tipo_uso = any (array['passagem', 'contrato', 'estacionamento', 'adesao', 'outras_taxas', 'credito_plano_contratado']));

create or replace function pedagio.normalizar_tipo_uso(p_texto text)
 returns text
 language plpgsql
 immutable
 set search_path to ''
as $function$
declare
  v_norm text := regexp_replace(translate(upper(trim(coalesce(p_texto, ''))), 'ÁÀÂÃÉÊÍÓÔÕÚÇ', 'AAAAEEIOOOUC'), '\s+', ' ', 'g');
begin
  if v_norm in ('PASSAGEM', 'PASSAGENS') then
    return 'passagem';
  elsif v_norm in ('CONTRATO', 'PLANO CONTRATADO') then
    return 'contrato';
  elsif v_norm in ('ESTACIONAMENTO', 'ESTACINOAMENTO') then
    return 'estacionamento';
  elsif v_norm = 'ADESAO' then
    return 'adesao';
  elsif v_norm = 'OUTRAS TAXAS' then
    return 'outras_taxas';
  elsif v_norm = 'CREDITO PLANO CONTRATADO' then
    return 'credito_plano_contratado';
  else
    return null;
  end if;
end;
$function$;

-- 2) staging por lote + erros por motivo
alter table pedagio.staging_passagem_pedagio
  add column lote_id uuid references pedagio.lote_importacao(id) on delete cascade;
create index staging_passagem_pedagio_lote_id_idx on pedagio.staging_passagem_pedagio (lote_id, id);

alter table pedagio.lote_importacao
  add column erros_por_motivo jsonb not null default '{}'::jsonb;

-- ocorrência: 1ª, 2ª… vez que a mesma linha aparece no arquivo
alter table pedagio.staging_passagem_pedagio add column ocorrencia smallint;
alter table pedagio.passagem_pedagio
  add column ocorrencia smallint not null default 1 check (ocorrencia >= 1);
alter table pedagio.passagem_pedagio drop constraint passagem_pedagio_dedup_uniq;
alter table pedagio.passagem_pedagio add constraint passagem_pedagio_dedup_uniq
  unique (placa_informada, data_hora, condicao, valor_cobrado, ocorrencia);

-- 3) praça sem sentido: reconhecida pela Descrição
create or replace function pedagio.obter_ou_criar_praca_importacao(p_nome text, p_sentido text, p_lote_id uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id uuid;
  v_sentido text := nullif(upper(trim(coalesce(p_sentido, ''))), '');
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
  perform pg_advisory_xact_lock(hashtext('pedagio.praca:' || upper(trim(p_nome))));

  -- 1º: mesmo nome e mesmo sentido
  select id into v_id
  from pedagio.praca_pedagio
  where upper(trim(nome)) = upper(trim(p_nome))
    and coalesce(upper(trim(sentido)), '') = coalesce(v_sentido, '')
  order by created_at
  limit 1;

  -- 2º (FASE 23): a Descrição já identifica a praça/sentido — linha sem
  -- sentido usa a praça de mesmo nome; linha com sentido usa a praça de mesmo
  -- nome que tenha sido criada sem sentido
  if v_id is null then
    select id into v_id
    from pedagio.praca_pedagio
    where upper(trim(nome)) = upper(trim(p_nome))
      and (v_sentido is null or coalesce(trim(sentido), '') = '')
    order by created_at
    limit 1;
  end if;

  if v_id is null then
    insert into pedagio.praca_pedagio (nome, sentido, cadastro_pendente, criada_no_lote_id)
    values (trim(p_nome), nullif(trim(p_sentido), ''), true, p_lote_id)
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

-- 4) bloco: processa até p_limite linhas da staging deste lote
create or replace function pedagio.processar_bloco_passagens(p_lote_id uuid, p_limite integer default 500)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
  v_row record;
  v_ids bigint[] := '{}';
  v_inseridos uuid[] := '{}';
  v_motivos jsonb := '{}'::jsonb;
  v_total int := 0;
  v_erros int := 0;
  v_motivo text;
  v_data_hora timestamptz;
  v_valor numeric(10,2);
  v_tipo_uso text;
  v_condicao text;
  v_sem_descricao boolean;
  v_veiculo_id uuid;
  v_praca_id uuid;
  v_estacionamento_id uuid;
  v_viagem_id uuid;
  v_embarcador_id uuid;
  v_status text;
  v_passagem_id uuid;
  v_restantes int;
  v_chave text;
begin
  if not exists (select 1 from pedagio.lote_importacao where id = p_lote_id and tipo = 'passagens') then
    raise exception 'lote de passagens % nao encontrado', p_lote_id;
  end if;

  for v_row in
    select * from pedagio.staging_passagem_pedagio
    where lote_id = p_lote_id
    order by id
    limit greatest(coalesce(p_limite, 500), 1)
  loop
    v_total := v_total + 1;
    v_ids := v_ids || v_row.id;
    v_motivo := null;

    begin
      v_data_hora := pedagio.parse_data_hora_planilha(v_row.data_texto, v_row.horario_texto);
      v_valor := pedagio.parse_valor_brl(v_row.valor_texto);
      v_tipo_uso := pedagio.normalizar_tipo_uso(v_row.tipo_uso_texto);
      v_condicao := pedagio.normalizar_condicao(v_row.condicao_texto);
      v_sem_descricao := v_row.praca_nome is null or trim(v_row.praca_nome) = '';

      if v_tipo_uso is null then
        v_motivo := 'Tipo de uso não reconhecido: ' || coalesce(nullif(trim(v_row.tipo_uso_texto), ''), '(vazio)');
      elsif v_data_hora is null then
        v_motivo := 'Data/Horário inválido';
      elsif v_valor is null then
        v_motivo := 'Valor inválido';
      elsif v_condicao is null then
        v_motivo := 'Débito/Crédito não reconhecido: ' || coalesce(nullif(trim(v_row.condicao_texto), ''), '(vazio)');
      elsif v_sem_descricao and v_tipo_uso = 'estacionamento' then
        v_motivo := 'Estacionamento sem Descrição';
      elsif v_sem_descricao and v_tipo_uso = 'passagem' and v_condicao = 'debito' then
        -- crédito de vale-pedágio pode vir sem Descrição; débito precisa da praça
        v_motivo := 'Passagem (débito) sem Descrição';
      end if;

      if v_motivo is null then
        v_valor := case when v_condicao = 'debito' then abs(v_valor) else -abs(v_valor) end;

        select id into v_veiculo_id from pedagio.veiculo where tipo = 'cavalo' and upper(trim(placa)) = upper(trim(v_row.placa)) limit 1;

        v_praca_id := null;
        v_estacionamento_id := null;

        -- FASE 22: praça/estacionamento não cadastrado é criado com os dados da
        -- planilha e fica como cadastro pendente (ver obter_ou_criar_*_importacao)
        if v_tipo_uso = 'estacionamento' then
          v_estacionamento_id := pedagio.obter_ou_criar_estacionamento_importacao(v_row.praca_nome, p_lote_id);
        elsif v_tipo_uso = 'passagem' and not v_sem_descricao then
          v_praca_id := pedagio.obter_ou_criar_praca_importacao(v_row.praca_nome, v_row.sentido, p_lote_id);
        elsif v_tipo_uso <> 'passagem' and not v_sem_descricao then
          -- contrato/taxas: só liga a uma praça já cadastrada, nunca cria cadastro pendente
          select id into v_praca_id
          from pedagio.praca_pedagio
          where upper(trim(nome)) = upper(trim(v_row.praca_nome))
            and upper(trim(coalesce(sentido, ''))) = upper(trim(coalesce(v_row.sentido, '')))
          order by created_at
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

        -- só passagem com praça e estacionamento passam pela validação
        v_status := case
          when v_tipo_uso = 'estacionamento' then 'pendente'
          when v_tipo_uso = 'passagem' and not v_sem_descricao then 'pendente'
          else 'nao_aplicavel'
        end;

        v_passagem_id := null;
        insert into pedagio.passagem_pedagio (
          numero_fatura, veiculo_id, placa_informada, tipo_veiculo_informado,
          praca_id, praca_informada, sentido_informado, tipo_uso, condicao,
          data_hora, valor_cobrado, viagem_informada, viagem_id, embarcador_informada, embarcador_id,
          estacionamento_id, lote_importacao_id, status_validacao, ocorrencia
        ) values (
          v_row.numero_fatura, v_veiculo_id, v_row.placa, v_row.tipo_veiculo,
          v_praca_id, nullif(trim(v_row.praca_nome), ''), v_row.sentido, v_tipo_uso, v_condicao,
          v_data_hora, v_valor, v_row.viagem, v_viagem_id, v_row.embarcador, v_embarcador_id,
          v_estacionamento_id, p_lote_id, v_status, greatest(coalesce(v_row.ocorrencia, 1), 1)
        )
        on conflict (placa_informada, data_hora, condicao, valor_cobrado, ocorrencia) do nothing
        returning id into v_passagem_id;

        if v_passagem_id is null then
          v_motivo := 'Linha já importada (mesma placa, data/hora, débito/crédito e valor)';
        elsif v_status = 'pendente' then
          v_inseridos := v_inseridos || v_passagem_id;
        end if;
      end if;
    exception when others then
      v_motivo := 'Erro inesperado: ' || sqlerrm;
    end;

    if v_motivo is not null then
      v_erros := v_erros + 1;
      v_motivos := jsonb_set(v_motivos, array[v_motivo], to_jsonb(coalesce((v_motivos->>v_motivo)::int, 0) + 1));
    end if;
  end loop;

  delete from pedagio.staging_passagem_pedagio where id = any(v_ids);

  -- valida só o que este bloco inseriu (processar_validacoes_pendentes varre o banco todo)
  for v_row in
    select id, tipo_uso from pedagio.passagem_pedagio where id = any(v_inseridos) and status_validacao = 'pendente'
  loop
    if v_row.tipo_uso = 'estacionamento' then
      perform pedagio.validar_estacionamento(v_row.id);
    else
      perform pedagio.validar_passagem(v_row.id);
    end if;
  end loop;

  -- acumula no lote (vários blocos por lote)
  update pedagio.lote_importacao l set
    total_linhas = coalesce(l.total_linhas, 0) + v_total,
    total_erros = coalesce(l.total_erros, 0) + v_erros,
    erros_por_motivo = (
      select coalesce(jsonb_object_agg(k, coalesce((l.erros_por_motivo->>k)::int, 0) + coalesce((v_motivos->>k)::int, 0)), '{}'::jsonb)
      from (select jsonb_object_keys(l.erros_por_motivo || v_motivos) k) chaves
    )
  where l.id = p_lote_id;

  select count(*) into v_restantes from pedagio.staging_passagem_pedagio where lote_id = p_lote_id;

  return jsonb_build_object('processadas', v_total, 'erros', v_erros, 'restantes', v_restantes, 'erros_por_motivo', v_motivos);
end;
$function$;

-- 5) caminho manual via SQL (docs/importacao.md): mesmo comportamento de
-- antes (processa tudo que está na staging sem lote), agora em cima do bloco
create or replace function pedagio.processar_staging_passagens(p_arquivo_nome text default null::text, p_usuario text default null::text)
returns pedagio.lote_importacao
language plpgsql
set search_path to ''
as $function$
declare
  v_lote_id uuid;
  v_lote pedagio.lote_importacao;
  v_res jsonb;
begin
  if not exists (select 1 from pedagio.staging_passagem_pedagio where lote_id is null) then
    raise exception 'pedagio.staging_passagem_pedagio esta vazia, nada para importar';
  end if;

  insert into pedagio.lote_importacao (tipo, arquivo_nome, usuario, total_linhas, total_erros)
  values ('passagens', p_arquivo_nome, p_usuario, 0, 0)
  returning id into v_lote_id;

  update pedagio.staging_passagem_pedagio set lote_id = v_lote_id where lote_id is null;

  -- mesma numeração de ocorrência que o app calcula (linha idêntica no arquivo)
  update pedagio.staging_passagem_pedagio s set ocorrencia = n.rn
  from (
    select id, row_number() over (
      partition by numero_fatura, data_texto, horario_texto, placa, tipo_veiculo, praca_nome,
        tipo_uso_texto, valor_texto, condicao_texto, viagem, embarcador, sentido
      order by id) rn
    from pedagio.staging_passagem_pedagio where lote_id = v_lote_id
  ) n
  where s.id = n.id and s.ocorrencia is null;

  loop
    v_res := pedagio.processar_bloco_passagens(v_lote_id, 1000);
    exit when (v_res->>'restantes')::int = 0;
  end loop;

  select * into v_lote from pedagio.lote_importacao where id = v_lote_id;
  return v_lote;
end;
$function$;

-- 6) resumo da fatura com os tipos novos (colunas anexadas ao final)
create or replace view pedagio.vw_fatura_resumo with (security_invoker = true) as
 SELECT numero_fatura,
    count(*) AS qtd_total,
    count(*) FILTER (WHERE tipo_uso = 'passagem'::text) AS qtd_passagem,
    count(*) FILTER (WHERE tipo_uso = 'contrato'::text) AS qtd_contrato,
    sum(valor_cobrado) AS valor_total,
    sum(valor_cobrado) FILTER (WHERE tipo_uso = 'passagem'::text) AS valor_passagem,
    sum(valor_cobrado) FILTER (WHERE tipo_uso = 'contrato'::text) AS valor_contrato,
    min(data_hora) AS periodo_inicio,
    max(data_hora) AS periodo_fim,
    count(*) FILTER (WHERE status_validacao = 'ok'::text) AS qtd_ok,
    count(*) FILTER (WHERE status_validacao = 'pendente'::text) AS qtd_pendente,
    count(*) FILTER (WHERE status_validacao = 'sem_dados_gps'::text) AS qtd_sem_dados_gps,
    count(*) FILTER (WHERE status_validacao = 'sem_cadastro'::text) AS qtd_sem_cadastro,
    count(*) FILTER (WHERE status_validacao = 'valor_divergente'::text) AS qtd_valor_divergente,
    count(*) FILTER (WHERE status_validacao = 'fora_poligono'::text) AS qtd_fora_poligono,
    count(*) FILTER (WHERE status_validacao = 'local_e_valor_divergentes'::text) AS qtd_local_e_valor_divergentes,
    count(*) FILTER (WHERE status_validacao = 'nao_aplicavel'::text) AS qtd_nao_aplicavel,
    count(*) FILTER (WHERE tipo_uso = 'estacionamento'::text) AS qtd_estacionamento,
    sum(valor_cobrado) FILTER (WHERE tipo_uso = 'estacionamento'::text) AS valor_estacionamento,
    count(*) FILTER (WHERE tipo_uso = 'adesao'::text) AS qtd_adesao,
    sum(valor_cobrado) FILTER (WHERE tipo_uso = 'adesao'::text) AS valor_adesao,
    count(*) FILTER (WHERE tipo_uso = 'outras_taxas'::text) AS qtd_outras_taxas,
    sum(valor_cobrado) FILTER (WHERE tipo_uso = 'outras_taxas'::text) AS valor_outras_taxas,
    count(*) FILTER (WHERE tipo_uso = 'credito_plano_contratado'::text) AS qtd_credito_plano_contratado,
    sum(valor_cobrado) FILTER (WHERE tipo_uso = 'credito_plano_contratado'::text) AS valor_credito_plano_contratado
   FROM pedagio.passagem_pedagio
  GROUP BY numero_fatura;

-- 7) validar_passagem: crédito sem praça = nao_aplicavel (resto igual à versão ativa)
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

  -- FASE 23: crédito de vale-pedágio sem Descrição (sem praça) não é cobrança
  -- de praça — não se valida GPS/tarifa, também em revalidações posteriores
  if v_passagem.condicao = 'credito' and v_passagem.praca_id is null
    and coalesce(trim(v_passagem.praca_informada), '') = '' then
    update pedagio.passagem_pedagio set status_validacao = 'nao_aplicavel' where id = p_passagem_id;
    return null;
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
