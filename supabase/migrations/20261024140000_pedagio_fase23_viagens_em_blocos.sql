-- FASE 23 (viagens): importar transporte.csv (4.981 viagens) estourava o
-- statement_timeout de 8 s do papel authenticated ("canceling statement due
-- to statement timeout") — tudo numa chamada só, ~4,7 s medidos por conexão
-- direta e mais pela API. Mesmo tratamento das passagens: staging por lote,
-- processamento em blocos com erros por motivo, e o caminho manual via SQL
-- vira laço sobre o bloco.
--
-- Índices: a importação de viagens procura passagens por
-- upper(trim(placa_informada)) + período (embarcador e revalidação) e
-- validar_passagem procura viagem_transporte da mesma forma — sem índice de
-- expressão, cada linha varria a tabela inteira (34 mil passagens de um mês
-- × 5 mil viagens).
--
-- RLS (medido): como usuário logado, upper()/trim() não são "leakproof", então
-- o planejador tira a placa da condição do índice e lê todas as passagens do
-- período, chamando usuario_autorizado() em cada linha (0,07 ms → 8 ms por
-- busca; o bloco de viagens estourava os 8 s). Por isso:
-- 1) os blocos de importação (passagens e viagens) passam a SECURITY DEFINER,
--    com a mesma checagem de autorização dos outros helpers, uma vez na entrada;
-- 2) todas as políticas do schema chamam (select pedagio.usuario_autorizado())
--    / (select pedagio.eh_admin()) — mesmo efeito, avaliado uma vez por
--    consulta em vez de uma vez por linha (recomendação do Supabase,
--    auth_rls_initplan); vale para listas e painel com o volume de um mês.

create index passagem_pedagio_placa_norm_data_idx
  on pedagio.passagem_pedagio (upper(trim(placa_informada)), data_hora);
create index viagem_transporte_placa_norm_saida_idx
  on pedagio.viagem_transporte (upper(trim(placa_informada)), data_hora_saida);

alter table pedagio.staging_viagem_transporte
  add column lote_id uuid references pedagio.lote_importacao(id) on delete cascade;
create index staging_viagem_transporte_lote_id_idx on pedagio.staging_viagem_transporte (lote_id, id);

create or replace function pedagio.processar_bloco_viagens_transporte(p_lote_id uuid, p_limite integer default 200)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_row record;
  v_ids bigint[] := '{}';
  v_motivos jsonb := '{}'::jsonb;
  v_total int := 0;
  v_erros int := 0;
  v_motivo text;
  v_saida timestamptz;
  v_chegada timestamptz;
  v_tipo_viagem text;
  v_veiculo_id uuid;
  v_embarcador_id uuid;
  v_viagem_id uuid;
  v_restantes int;
begin
  -- SECURITY DEFINER (ver cabeçalho desta migration): autoriza uma vez aqui
  if session_user = 'authenticator'
    and coalesce(auth.role(), '') <> 'service_role'
    and not pedagio.usuario_autorizado() then
    raise exception 'usuario nao autorizado';
  end if;

  if not exists (select 1 from pedagio.lote_importacao where id = p_lote_id and tipo = 'viagens_transporte') then
    raise exception 'lote de viagens % nao encontrado', p_lote_id;
  end if;

  for v_row in
    select * from pedagio.staging_viagem_transporte
    where lote_id = p_lote_id
    order by id
    limit greatest(coalesce(p_limite, 200), 1)
  loop
    v_total := v_total + 1;
    v_ids := v_ids || v_row.id;
    v_motivo := null;

    begin
      v_saida := pedagio.parse_data_hora_combinada(v_row.data_hora_saida_texto);
      v_chegada := pedagio.parse_data_hora_combinada(v_row.data_hora_chegada_texto);
      v_tipo_viagem := pedagio.normalizar_tipo_viagem(v_row.tipo_viagem_texto);

      if v_row.numero_transporte is null or trim(v_row.numero_transporte) = '' then
        v_motivo := 'Número do transporte vazio';
      elsif v_row.placa is null or trim(v_row.placa) = '' then
        v_motivo := 'Placa vazia';
      elsif v_saida is null then
        v_motivo := 'Data/hora de saída inválida';
      elsif v_chegada is null then
        v_motivo := 'Data/hora de chegada inválida';
      elsif v_tipo_viagem is null then
        v_motivo := 'Tipo de viagem não reconhecido: ' || coalesce(nullif(trim(v_row.tipo_viagem_texto), ''), '(vazio)');
      end if;

      if v_motivo is null then
        select id into v_veiculo_id from pedagio.veiculo where tipo = 'cavalo' and upper(trim(placa)) = upper(trim(v_row.placa)) limit 1;

        v_embarcador_id := null;
        select embarcador_id into v_embarcador_id
        from pedagio.passagem_pedagio
        where upper(trim(placa_informada)) = upper(trim(v_row.placa))
          and data_hora between v_saida and v_chegada
          and embarcador_id is not null
        order by data_hora
        limit 1;

        v_viagem_id := null;
        insert into pedagio.viagem_transporte (
          numero_transporte, veiculo_id, placa_informada, cidade_origem, uf_origem,
          cidade_destino, uf_destino, data_hora_saida, data_hora_chegada,
          carreta1, carreta2, tipo_viagem, embarcador_id, lote_importacao_id
        ) values (
          trim(v_row.numero_transporte), v_veiculo_id, v_row.placa, v_row.cidade_origem, v_row.uf_origem,
          v_row.cidade_destino, v_row.uf_destino, v_saida, v_chegada,
          v_row.carreta1, v_row.carreta2, v_tipo_viagem, v_embarcador_id, p_lote_id
        )
        on conflict (numero_transporte) do nothing
        returning id into v_viagem_id;

        if v_viagem_id is null then
          v_motivo := 'Viagem já importada (mesmo número de transporte)';
        else
          perform pedagio.revalidar_passagens_da_viagem(v_viagem_id);
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

  delete from pedagio.staging_viagem_transporte where id = any(v_ids);

  update pedagio.lote_importacao l set
    total_linhas = coalesce(l.total_linhas, 0) + v_total,
    total_erros = coalesce(l.total_erros, 0) + v_erros,
    erros_por_motivo = (
      select coalesce(jsonb_object_agg(k, coalesce((l.erros_por_motivo->>k)::int, 0) + coalesce((v_motivos->>k)::int, 0)), '{}'::jsonb)
      from (select jsonb_object_keys(l.erros_por_motivo || v_motivos) k) chaves
    )
  where l.id = p_lote_id;

  select count(*) into v_restantes from pedagio.staging_viagem_transporte where lote_id = p_lote_id;

  return jsonb_build_object('processadas', v_total, 'erros', v_erros, 'restantes', v_restantes, 'erros_por_motivo', v_motivos);
end;
$function$;

-- caminho manual via SQL (docs/importacao.md): processa a staging sem lote
create or replace function pedagio.processar_staging_viagens_transporte(p_arquivo_nome text default null::text, p_usuario text default null::text)
returns pedagio.lote_importacao
language plpgsql
set search_path to ''
as $function$
declare
  v_lote_id uuid;
  v_lote pedagio.lote_importacao;
  v_res jsonb;
begin
  if not exists (select 1 from pedagio.staging_viagem_transporte where lote_id is null) then
    raise exception 'pedagio.staging_viagem_transporte esta vazia, nada para importar';
  end if;

  insert into pedagio.lote_importacao (tipo, arquivo_nome, usuario, total_linhas, total_erros)
  values ('viagens_transporte', p_arquivo_nome, p_usuario, 0, 0)
  returning id into v_lote_id;

  update pedagio.staging_viagem_transporte set lote_id = v_lote_id where lote_id is null;

  loop
    v_res := pedagio.processar_bloco_viagens_transporte(v_lote_id, 1000);
    exit when (v_res->>'restantes')::int = 0;
  end loop;

  select * into v_lote from pedagio.lote_importacao where id = v_lote_id;
  return v_lote;
end;
$function$;

-- Estatísticas logo após uma importação grande: sem elas o planejador não
-- sabe que passagem_pedagio acabou de ganhar dezenas de milhares de linhas e
-- ignora os índices acima — importar viagens logo depois das passagens de um
-- mês estourava o timeout no teste. O autovacuum acaba atualizando, mas só
-- minutos depois. ANALYZE exige ser dono da tabela, por isso SECURITY
-- DEFINER; só usuário autorizado (pela API) ou conexão direta.
create or replace function pedagio.atualizar_estatisticas_importacao()
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if session_user = 'authenticator'
    and coalesce(auth.role(), '') <> 'service_role'
    and not pedagio.usuario_autorizado() then
    raise exception 'usuario nao autorizado';
  end if;

  analyze pedagio.passagem_pedagio;
  analyze pedagio.viagem_transporte;
  analyze pedagio.praca_pedagio;
end;
$$;

-- 1b) bloco de passagens como SECURITY DEFINER (resto igual à versão ativa)
CREATE OR REPLACE FUNCTION pedagio.processar_bloco_passagens(p_lote_id uuid, p_limite integer DEFAULT 500)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  -- SECURITY DEFINER (ver cabeçalho desta migration): autoriza uma vez aqui
  if session_user = 'authenticator'
    and coalesce(auth.role(), '') <> 'service_role'
    and not pedagio.usuario_autorizado() then
    raise exception 'usuario nao autorizado';
  end if;

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

-- 2) políticas: função avaliada uma vez por consulta
alter policy atualizacao_admin on pedagio.categoria_veiculo using ((select pedagio.eh_admin())) with check ((select pedagio.eh_admin()));
alter policy exclusao_admin on pedagio.categoria_veiculo using ((select pedagio.eh_admin()));
alter policy insercao_admin on pedagio.categoria_veiculo with check ((select pedagio.eh_admin()));
alter policy leitura_autorizados on pedagio.categoria_veiculo using ((select pedagio.usuario_autorizado()));
alter policy atualizacao_admin on pedagio.embarcador using ((select pedagio.eh_admin())) with check ((select pedagio.eh_admin()));
alter policy exclusao_admin on pedagio.embarcador using ((select pedagio.eh_admin()));
alter policy insercao_autorizados on pedagio.embarcador with check ((select pedagio.usuario_autorizado()));
alter policy leitura_autorizados on pedagio.embarcador using ((select pedagio.usuario_autorizado()));
alter policy atualizacao_admin on pedagio.estacionamento using ((select pedagio.eh_admin())) with check ((select pedagio.eh_admin()));
alter policy exclusao_admin on pedagio.estacionamento using ((select pedagio.eh_admin()));
alter policy insercao_admin on pedagio.estacionamento with check ((select pedagio.eh_admin()));
alter policy leitura_autorizados on pedagio.estacionamento using ((select pedagio.usuario_autorizado()));
alter policy atualizacao_autorizados on pedagio.lote_importacao using ((select pedagio.usuario_autorizado())) with check ((select pedagio.usuario_autorizado()));
alter policy exclusao_admin on pedagio.lote_importacao using ((select pedagio.eh_admin()));
alter policy insercao_autorizados on pedagio.lote_importacao with check ((select pedagio.usuario_autorizado()));
alter policy leitura_autorizados on pedagio.lote_importacao using ((select pedagio.usuario_autorizado()));
alter policy atualizacao_autorizados on pedagio.passagem_pedagio using ((select pedagio.usuario_autorizado())) with check ((select pedagio.usuario_autorizado()));
alter policy exclusao_admin on pedagio.passagem_pedagio using ((select pedagio.eh_admin()));
alter policy insercao_autorizados on pedagio.passagem_pedagio with check ((select pedagio.usuario_autorizado()));
alter policy leitura_autorizados on pedagio.passagem_pedagio using ((select pedagio.usuario_autorizado()));
alter policy atualizacao_admin on pedagio.posicao_veiculo using ((select pedagio.eh_admin())) with check ((select pedagio.eh_admin()));
alter policy exclusao_admin on pedagio.posicao_veiculo using ((select pedagio.eh_admin()));
alter policy insercao_autorizados on pedagio.posicao_veiculo with check ((select pedagio.usuario_autorizado()));
alter policy leitura_autorizados on pedagio.posicao_veiculo using ((select pedagio.usuario_autorizado()));
alter policy atualizacao_admin on pedagio.praca_pedagio using ((select pedagio.eh_admin())) with check ((select pedagio.eh_admin()));
alter policy exclusao_admin on pedagio.praca_pedagio using ((select pedagio.eh_admin()));
alter policy insercao_admin on pedagio.praca_pedagio with check ((select pedagio.eh_admin()));
alter policy leitura_autorizados on pedagio.praca_pedagio using ((select pedagio.usuario_autorizado()));
alter policy acesso_autorizados on pedagio.staging_passagem_pedagio using ((select pedagio.usuario_autorizado())) with check ((select pedagio.usuario_autorizado()));
alter policy acesso_autorizados on pedagio.staging_posicao_veiculo using ((select pedagio.usuario_autorizado())) with check ((select pedagio.usuario_autorizado()));
alter policy acesso_autorizados on pedagio.staging_viagem_transporte using ((select pedagio.usuario_autorizado())) with check ((select pedagio.usuario_autorizado()));
alter policy atualizacao_admin on pedagio.tarifa_estacionamento using ((select pedagio.eh_admin())) with check ((select pedagio.eh_admin()));
alter policy exclusao_admin on pedagio.tarifa_estacionamento using ((select pedagio.eh_admin()));
alter policy insercao_admin on pedagio.tarifa_estacionamento with check ((select pedagio.eh_admin()));
alter policy leitura_autorizados on pedagio.tarifa_estacionamento using ((select pedagio.usuario_autorizado()));
alter policy atualizacao_admin on pedagio.tarifa_praca using ((select pedagio.eh_admin())) with check ((select pedagio.eh_admin()));
alter policy exclusao_admin on pedagio.tarifa_praca using ((select pedagio.eh_admin()));
alter policy insercao_admin on pedagio.tarifa_praca with check ((select pedagio.eh_admin()));
alter policy leitura_autorizados on pedagio.tarifa_praca using ((select pedagio.usuario_autorizado()));
alter policy usuario_perfil_admin_all on pedagio.usuario_perfil using ((select pedagio.eh_admin())) with check ((select pedagio.eh_admin()));
alter policy atualizacao_autorizados on pedagio.validacao_estacionamento using ((select pedagio.usuario_autorizado())) with check ((select pedagio.usuario_autorizado()));
alter policy exclusao_admin on pedagio.validacao_estacionamento using ((select pedagio.eh_admin()));
alter policy insercao_autorizados on pedagio.validacao_estacionamento with check ((select pedagio.usuario_autorizado()));
alter policy leitura_autorizados on pedagio.validacao_estacionamento using ((select pedagio.usuario_autorizado()));
alter policy atualizacao_autorizados on pedagio.validacao_passagem using ((select pedagio.usuario_autorizado())) with check ((select pedagio.usuario_autorizado()));
alter policy exclusao_admin on pedagio.validacao_passagem using ((select pedagio.eh_admin()));
alter policy insercao_autorizados on pedagio.validacao_passagem with check ((select pedagio.usuario_autorizado()));
alter policy leitura_autorizados on pedagio.validacao_passagem using ((select pedagio.usuario_autorizado()));
alter policy atualizacao_admin on pedagio.veiculo using ((select pedagio.eh_admin())) with check ((select pedagio.eh_admin()));
alter policy exclusao_admin on pedagio.veiculo using ((select pedagio.eh_admin()));
alter policy insercao_admin on pedagio.veiculo with check ((select pedagio.eh_admin()));
alter policy leitura_autorizados on pedagio.veiculo using ((select pedagio.usuario_autorizado()));
alter policy atualizacao_admin on pedagio.viagem using ((select pedagio.eh_admin())) with check ((select pedagio.eh_admin()));
alter policy exclusao_admin on pedagio.viagem using ((select pedagio.eh_admin()));
alter policy insercao_autorizados on pedagio.viagem with check ((select pedagio.usuario_autorizado()));
alter policy leitura_autorizados on pedagio.viagem using ((select pedagio.usuario_autorizado()));
alter policy atualizacao_admin on pedagio.viagem_transporte using ((select pedagio.eh_admin())) with check ((select pedagio.eh_admin()));
alter policy exclusao_admin on pedagio.viagem_transporte using ((select pedagio.eh_admin()));
alter policy insercao_autorizados on pedagio.viagem_transporte with check ((select pedagio.usuario_autorizado()));
alter policy leitura_autorizados on pedagio.viagem_transporte using ((select pedagio.usuario_autorizado()));

-- 3) O embarcador da viagem é descoberto pelas passagens do período no
-- momento em que a viagem é importada; importando viagens antes das
-- passagens (medido: 1 de 4.981 com embarcador, contra 944 na ordem
-- inversa), ninguém voltava para preencher. Chamado ao finalizar uma
-- importação de passagens; só mexe em viagem ainda sem embarcador.
create or replace function pedagio.completar_embarcador_viagens()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_qtd int;
begin
  if session_user = 'authenticator'
    and coalesce(auth.role(), '') <> 'service_role'
    and not pedagio.usuario_autorizado() then
    raise exception 'usuario nao autorizado';
  end if;

  update pedagio.viagem_transporte vt set embarcador_id = (
    select p.embarcador_id
    from pedagio.passagem_pedagio p
    where upper(trim(p.placa_informada)) = upper(trim(vt.placa_informada))
      and p.data_hora between vt.data_hora_saida and vt.data_hora_chegada
      and p.embarcador_id is not null
    order by p.data_hora
    limit 1
  )
  where vt.embarcador_id is null
    and exists (
      select 1
      from pedagio.passagem_pedagio p
      where upper(trim(p.placa_informada)) = upper(trim(vt.placa_informada))
        and p.data_hora between vt.data_hora_saida and vt.data_hora_chegada
        and p.embarcador_id is not null
    );

  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$$;
