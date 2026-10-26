-- FASE 27: importação de posições de GPS em blocos.
-- Um CSV de GPS de mais de 10 MB falhava com "Body exceeded 1 MB limit": o
-- app mandava o arquivo inteiro numa chamada (e ainda limitava a 5.000
-- linhas). Mesmo tratamento das passagens e viagens (FASE 23): staging por
-- lote, o app lê o arquivo no navegador e envia blocos; erros por motivo.
--
-- Revalidação: o trigger posicao_veiculo_revalidar_passagens revalida, a
-- cada posição inserida, as passagens pendentes/sem GPS daquele veículo perto
-- daquele horário. Numa carga grande isso (a) multiplica o custo e (b) valida
-- a passagem contra o primeiro ponto que chega — se ele estiver fora do
-- polígono a passagem vira fora_poligono e não é reconferida quando o ponto
-- certo chega no bloco seguinte. Por isso, durante os blocos o trigger fica
-- desligado (GUC local à transação pedagio.gps_em_lote) e, no fim, o app
-- revalida em blocos as passagens pendentes/sem GPS dos veículos e do período
-- do lote, já com todas as posições gravadas. Inserção avulsa de posição
-- (fora da importação) continua revalidando pelo trigger.
--
-- Medido: validar_passagem ~8 ms por passagem → blocos de 200 (~1,6 s) contra
-- o statement_timeout de 8 s do papel authenticated.

alter table pedagio.staging_posicao_veiculo
  add column lote_id uuid references pedagio.lote_importacao(id) on delete cascade;

create index staging_posicao_veiculo_lote_idx on pedagio.staging_posicao_veiculo (lote_id, id);

-- trigger: igual ao anterior, com saída antecipada durante a importação em blocos
create or replace function pedagio.trg_revalidar_passagens_por_posicao()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
declare
  v_janela interval := pedagio.janela_tolerancia_validacao();
  v_janela_busca interval := pedagio.janela_busca_estacionamento();
  v_id uuid;
begin
  -- importação em blocos: a revalidação roda no fim (revalidar_bloco_passagens_gps)
  if current_setting('pedagio.gps_em_lote', true) = 'on' then
    return new;
  end if;

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
$function$;

-- Um bloco de posições do lote: parse, veículo (cavalo pela placa), insert.
-- SECURITY DEFINER pelo mesmo motivo dos blocos de passagens/viagens (custo
-- de RLS por linha); autoriza uma vez na entrada.
create or replace function pedagio.processar_bloco_posicoes(p_lote_id uuid, p_limite integer default 1000)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_total int;
  v_inseridas int;
  v_motivos jsonb;
  v_erros int;
  v_restantes int;
begin
  if session_user = 'authenticator'
    and coalesce(auth.role(), '') <> 'service_role'
    and not pedagio.usuario_autorizado() then
    raise exception 'usuario nao autorizado';
  end if;

  if not exists (select 1 from pedagio.lote_importacao where id = p_lote_id and tipo = 'posicoes_gps') then
    raise exception 'lote de posicoes % nao encontrado', p_lote_id;
  end if;

  perform set_config('pedagio.gps_em_lote', 'on', true);

  create temp table if not exists pg_temp.bloco_gps (
    id bigint, veiculo_id uuid, data_hora timestamptz, lat numeric, lon numeric, motivo text
  ) on commit drop;
  truncate pg_temp.bloco_gps;

  insert into pg_temp.bloco_gps (id, veiculo_id, data_hora, lat, lon)
  select s.id, v.id,
         pedagio.parse_data_hora_planilha(s.data_texto, s.horario_texto),
         pedagio.parse_coordenada(s.latitude_texto),
         pedagio.parse_coordenada(s.longitude_texto)
  from (
    select * from pedagio.staging_posicao_veiculo
    where lote_id = p_lote_id
    order by id
    limit greatest(coalesce(p_limite, 1000), 1)
  ) s
  left join lateral (
    select ve.id from pedagio.veiculo ve
    where ve.tipo = 'cavalo' and upper(trim(ve.placa)) = upper(trim(s.placa))
    limit 1
  ) v on true;

  update pg_temp.bloco_gps set motivo = case
    when data_hora is null then 'Data/hora inválida'
    when lat is null or lon is null or lat < -90 or lat > 90 or lon < -180 or lon > 180 then 'Coordenada inválida'
    when veiculo_id is null then 'Placa não cadastrada como cavalo mecânico'
  end;

  insert into pedagio.posicao_veiculo (veiculo_id, geom, data_hora, fonte, lote_importacao_id)
  select veiculo_id, extensions.ST_SetSRID(extensions.ST_MakePoint(lon, lat), 4326), data_hora, 'carga_arquivo', p_lote_id
  from pg_temp.bloco_gps
  where motivo is null
  on conflict (veiculo_id, data_hora) do nothing;
  get diagnostics v_inseridas = row_count;

  select count(*) into v_total from pg_temp.bloco_gps;

  select coalesce(jsonb_object_agg(motivo, qtd), '{}'::jsonb) into v_motivos
  from (
    select motivo, count(*) qtd from pg_temp.bloco_gps where motivo is not null group by motivo
    union all
    -- válidas que não entraram: mesmo veículo e horário já gravados (ou repetidas no bloco)
    select 'Posição repetida (mesmo veículo e horário)', (count(*) - v_inseridas)
    from pg_temp.bloco_gps where motivo is null
    having count(*) - v_inseridas > 0
  ) m;
  v_erros := v_total - v_inseridas;

  delete from pedagio.staging_posicao_veiculo s using pg_temp.bloco_gps b where s.id = b.id;

  update pedagio.lote_importacao l set
    total_linhas = coalesce(l.total_linhas, 0) + v_total,
    total_erros = coalesce(l.total_erros, 0) + v_erros,
    erros_por_motivo = (
      select coalesce(jsonb_object_agg(k, coalesce((l.erros_por_motivo->>k)::int, 0) + coalesce((v_motivos->>k)::int, 0)), '{}'::jsonb)
      from (select jsonb_object_keys(coalesce(l.erros_por_motivo, '{}'::jsonb) || v_motivos) k) chaves
    )
  where l.id = p_lote_id;

  select count(*) into v_restantes from pedagio.staging_posicao_veiculo where lote_id = p_lote_id;

  return jsonb_build_object('processadas', v_total, 'erros', v_erros, 'restantes', v_restantes, 'erros_por_motivo', v_motivos);
end;
$function$;

-- Revalidação do fim da importação, em blocos: passagens pendentes/sem GPS
-- dos veículos do lote, no período coberto pelas posições do lote (com a
-- mesma folga de janela do trigger). Cursor por id (p_apos) porque uma
-- passagem que continua sem GPS continua casando com o filtro. Na primeira
-- chamada (p_apos nulo) devolve também o total, para a barra de progresso.
create or replace function pedagio.revalidar_bloco_passagens_gps(
  p_lote_id uuid,
  p_apos uuid default null,
  p_limite integer default 200
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_janela interval := pedagio.janela_tolerancia_validacao();
  v_janela_busca interval := pedagio.janela_busca_estacionamento();
  v_row record;
  v_processadas int := 0;
  v_ultimo uuid;
  v_total int;
begin
  if session_user = 'authenticator'
    and coalesce(auth.role(), '') <> 'service_role'
    and not pedagio.usuario_autorizado() then
    raise exception 'usuario nao autorizado';
  end if;

  create temp table if not exists pg_temp.alvo_gps (id uuid primary key, tipo_uso text) on commit drop;
  truncate pg_temp.alvo_gps;

  insert into pg_temp.alvo_gps (id, tipo_uso)
  select pp.id, pp.tipo_uso
  from (
    select veiculo_id, min(data_hora) inicio, max(data_hora) fim
    from pedagio.posicao_veiculo
    where lote_importacao_id = p_lote_id
    group by veiculo_id
  ) r
  join pedagio.passagem_pedagio pp on pp.veiculo_id = r.veiculo_id
  where pp.status_validacao in ('pendente', 'sem_dados_gps')
    and (
      (pp.tipo_uso = 'passagem' and pp.data_hora between r.inicio - v_janela and r.fim + v_janela)
      or (pp.tipo_uso = 'estacionamento' and pp.data_hora between r.inicio - v_janela and r.fim + v_janela_busca)
    )
    and (p_apos is null or pp.id > p_apos);

  if p_apos is null then
    select count(*) into v_total from pg_temp.alvo_gps;
  end if;

  for v_row in select * from pg_temp.alvo_gps order by id limit greatest(coalesce(p_limite, 200), 1) loop
    if v_row.tipo_uso = 'passagem' then
      perform pedagio.validar_passagem(v_row.id);
    else
      perform pedagio.validar_estacionamento(v_row.id);
    end if;
    v_processadas := v_processadas + 1;
    v_ultimo := v_row.id;
  end loop;

  return jsonb_build_object('processadas', v_processadas, 'ultimo_id', v_ultimo, 'total', v_total);
end;
$function$;

-- Caminho manual via SQL (docs/importacao.md): mesma assinatura de antes;
-- vira laço sobre os blocos + revalidação. Linhas da staging sem lote_id
-- (carregadas à mão) entram num lote novo.
create or replace function pedagio.processar_staging_posicoes(p_arquivo_nome text default null, p_usuario text default null)
 returns pedagio.lote_importacao
 language plpgsql
 set search_path to ''
as $function$
declare
  v_lote_id uuid;
  v_res jsonb;
  v_apos uuid;
  v_lote pedagio.lote_importacao;
begin
  if not exists (select 1 from pedagio.staging_posicao_veiculo where lote_id is null) then
    raise exception 'pedagio.staging_posicao_veiculo esta vazia, nada para importar';
  end if;

  insert into pedagio.lote_importacao (tipo, arquivo_nome, usuario, total_linhas, total_erros)
  values ('posicoes_gps', p_arquivo_nome, p_usuario, 0, 0)
  returning id into v_lote_id;

  update pedagio.staging_posicao_veiculo set lote_id = v_lote_id where lote_id is null;

  loop
    v_res := pedagio.processar_bloco_posicoes(v_lote_id, 5000);
    exit when (v_res->>'restantes')::int = 0;
  end loop;

  -- o bloco liga o GPS em lote só para a própria transação; aqui é a mesma
  -- transação, então desliga antes de revalidar
  perform set_config('pedagio.gps_em_lote', 'off', true);
  loop
    v_res := pedagio.revalidar_bloco_passagens_gps(v_lote_id, v_apos, 1000);
    exit when (v_res->>'processadas')::int = 0;
    v_apos := (v_res->>'ultimo_id')::uuid;
  end loop;

  select * into v_lote from pedagio.lote_importacao where id = v_lote_id;
  return v_lote;
end;
$function$;
