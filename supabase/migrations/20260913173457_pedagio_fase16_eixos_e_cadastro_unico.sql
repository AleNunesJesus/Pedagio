-- FASE 16: categoria_veiculo ganha quantidade_eixos; veiculo e carreta viram
-- um cadastro só (veiculo.tipo cavalo/carreta); fallback de tarifa vira
-- coluna própria (categoria_fallback_id) já que categoria_veiculo_id passa a
-- significar "eixos próprios do veiculo/carreta".

-- 1) categoria_veiculo.quantidade_eixos
alter table pedagio.categoria_veiculo add column quantidade_eixos integer;

update pedagio.categoria_veiculo set quantidade_eixos = 6 where codigo = 'EIXO_6';
update pedagio.categoria_veiculo set quantidade_eixos = 7 where codigo = 'EIXO_7';
update pedagio.categoria_veiculo set quantidade_eixos = 9 where codigo = 'EIXO_9';

insert into pedagio.categoria_veiculo (codigo, descricao, quantidade_eixos) values
  ('EIXO_3', 'Eixos próprios — cavalo mecânico sozinho ou carreta comum', 3),
  ('EIXO_4', 'Eixos próprios — carreta vanderleia', 4);

alter table pedagio.categoria_veiculo alter column quantidade_eixos set not null;

-- 2) veiculo ganha tipo + categoria_fallback_id
alter table pedagio.veiculo
  add column tipo text not null default 'cavalo' check (tipo in ('cavalo', 'carreta')),
  add column categoria_fallback_id uuid references pedagio.categoria_veiculo(id);

alter table pedagio.veiculo
  add constraint veiculo_fallback_so_cavalo check (tipo = 'cavalo' or categoria_fallback_id is null);

-- 3) migrar dados existentes: cavalos atuais tinham categoria_veiculo_id = EIXO_6
-- usado só como fallback de tarifa -> vira categoria_fallback_id; categoria_veiculo_id
-- passa a ser a categoria de eixos próprios (EIXO_3, cavalo mecânico).
update pedagio.veiculo
set categoria_fallback_id = categoria_veiculo_id,
    categoria_veiculo_id = (select id from pedagio.categoria_veiculo where codigo = 'EIXO_3')
where tipo = 'cavalo';

-- 4) migrar carretas existentes para veiculo (tipo = 'carreta')
insert into pedagio.veiculo (placa, categoria_veiculo_id, frota, ativo, tipo, categoria_fallback_id, created_at)
select
  c.placa,
  case c.tipo
    when 'comum' then (select id from pedagio.categoria_veiculo where codigo = 'EIXO_3')
    when 'vanderleia' then (select id from pedagio.categoria_veiculo where codigo = 'EIXO_4')
  end,
  null,
  true,
  'carreta',
  null,
  c.created_at
from pedagio.carreta c;

create index veiculo_categoria_fallback_id_idx on pedagio.veiculo (categoria_fallback_id);

-- 5) trigger de revalidação que hoje mora em `carreta` passa a morar em `veiculo`
-- (só dispara quando a linha afetada é do tipo carreta) — precisa ser 2 triggers
-- porque o Postgres não permite referenciar NEW na condição WHEN de um trigger
-- que inclui DELETE
create trigger revalidar_apos_upsert_veiculo_carreta
after insert or update on pedagio.veiculo
for each row
when (new.tipo = 'carreta')
execute function pedagio.trigger_revalidar_por_carreta();

create trigger revalidar_apos_exclusao_veiculo_carreta
after delete on pedagio.veiculo
for each row
when (old.tipo = 'carreta')
execute function pedagio.trigger_revalidar_por_carreta();

-- 6) tabela carreta não é mais necessária (dados já migrados) — remove tabela,
-- trigger antigo e policies próprias junto
drop table pedagio.carreta;

-- 7) categoria_por_composicao: eixos vêm do cadastro (quantidade_eixos) em vez
-- de constantes fixas (cavalo sempre 3, carreta por `tipo` comum/vanderleia)
create or replace function pedagio.categoria_por_composicao(p_placa text, p_data_hora timestamp with time zone)
returns uuid
language plpgsql
set search_path to ''
as $function$
declare
  v_viagem pedagio.viagem_transporte;
  v_eixos_cavalo int;
  v_eixos_carreta1 int;
  v_eixos_carreta2 int;
  v_total_eixos int;
  v_categoria_id uuid;
begin
  select vt.* into v_viagem
  from pedagio.viagem_transporte vt
  where upper(trim(vt.placa_informada)) = upper(trim(p_placa))
    and p_data_hora between vt.data_hora_saida and vt.data_hora_chegada
  order by vt.data_hora_saida
  limit 1;

  if not found or v_viagem.carreta1 is null or trim(v_viagem.carreta1) = '' then
    return null;
  end if;

  select cv.quantidade_eixos into v_eixos_cavalo
  from pedagio.veiculo v
  join pedagio.categoria_veiculo cv on cv.id = v.categoria_veiculo_id
  where v.tipo = 'cavalo' and upper(trim(v.placa)) = upper(trim(p_placa));

  if v_eixos_cavalo is null then
    return null;
  end if;

  select cv.quantidade_eixos into v_eixos_carreta1
  from pedagio.veiculo v
  join pedagio.categoria_veiculo cv on cv.id = v.categoria_veiculo_id
  where v.tipo = 'carreta' and upper(trim(v.placa)) = upper(trim(v_viagem.carreta1));

  if v_eixos_carreta1 is null then
    return null;
  end if;

  v_total_eixos := v_eixos_cavalo + v_eixos_carreta1;

  if v_viagem.carreta2 is not null and trim(v_viagem.carreta2) <> '' then
    select cv.quantidade_eixos into v_eixos_carreta2
    from pedagio.veiculo v
    join pedagio.categoria_veiculo cv on cv.id = v.categoria_veiculo_id
    where v.tipo = 'carreta' and upper(trim(v.placa)) = upper(trim(v_viagem.carreta2));

    if v_eixos_carreta2 is null then
      return null;
    end if;

    v_total_eixos := v_total_eixos + v_eixos_carreta2;
  end if;

  select id into v_categoria_id
  from pedagio.categoria_veiculo
  where quantidade_eixos = v_total_eixos;

  return v_categoria_id;
end;
$function$;

-- 8) validar_passagem: fallback passa a usar categoria_fallback_id (categoria_veiculo_id
-- do veiculo agora significa eixos próprios, não mais categoria de tarifa)
create or replace function pedagio.validar_passagem(p_passagem_id uuid)
returns pedagio.validacao_passagem
language plpgsql
set search_path to ''
as $function$
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
begin
  select * into v_passagem from pedagio.passagem_pedagio where id = p_passagem_id;
  if not found then
    raise exception 'passagem % nao encontrada', p_passagem_id;
  end if;

  if v_passagem.veiculo_id is null or v_passagem.praca_id is null then
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
    categoria_veiculo_id, origem_categoria
  ) values (
    p_passagem_id, v_posicao.id, v_dentro, v_distancia,
    v_diferenca, v_tarifa, v_divergencia, v_resultado, now(),
    v_categoria_id, v_origem_categoria
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
    origem_categoria = excluded.origem_categoria
  returning * into v_validacao;

  update pedagio.passagem_pedagio set status_validacao = v_resultado where id = p_passagem_id;

  return v_validacao;
end;
$function$;

-- 9) importação: matches por placa em veiculo passam a filtrar tipo = 'cavalo'
-- (carretas agora vivem na mesma tabela, mas nunca devem ser o veiculo_id de
-- uma passagem/posição de GPS/viagem de transporte — só cavalos passam pedágio
-- ou carregam rastreador próprio)
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
        or v_row.sentido is null or trim(v_row.sentido) = '' then
        v_erros := v_erros + 1;
        continue;
      end if;

      v_valor := case when v_condicao = 'debito' then abs(v_valor) else -abs(v_valor) end;

      select id into v_veiculo_id from pedagio.veiculo where tipo = 'cavalo' and upper(trim(placa)) = upper(trim(v_row.placa)) limit 1;

      select id into v_praca_id
      from pedagio.praca_pedagio
      where upper(trim(nome)) = upper(trim(coalesce(v_row.praca_nome, '')))
        and upper(trim(coalesce(sentido, ''))) = upper(trim(coalesce(v_row.sentido, '')))
      limit 1;

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
        lote_importacao_id, status_validacao
      ) values (
        v_row.numero_fatura, v_veiculo_id, v_row.placa, v_row.tipo_veiculo,
        v_praca_id, v_row.praca_nome, v_row.sentido, v_tipo_uso, v_condicao,
        v_data_hora, v_valor, v_row.viagem, v_viagem_id, v_row.embarcador, v_embarcador_id,
        v_lote_id, v_status
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

create or replace function pedagio.processar_staging_posicoes(p_arquivo_nome text DEFAULT NULL::text, p_usuario text DEFAULT NULL::text)
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
  v_lat numeric;
  v_lon numeric;
  v_veiculo_id uuid;
  v_lote pedagio.lote_importacao;
begin
  select array_agg(id) into v_ids from pedagio.staging_posicao_veiculo;
  if v_ids is null then
    raise exception 'pedagio.staging_posicao_veiculo esta vazia, nada para importar';
  end if;

  insert into pedagio.lote_importacao (tipo, arquivo_nome, usuario, total_linhas, total_erros)
  values ('posicoes_gps', p_arquivo_nome, p_usuario, array_length(v_ids, 1), 0)
  returning id into v_lote_id;

  for v_row in select * from pedagio.staging_posicao_veiculo where id = any(v_ids) order by id loop
    v_total := v_total + 1;

    v_data_hora := pedagio.parse_data_hora_planilha(v_row.data_texto, v_row.horario_texto);
    v_lat := pedagio.parse_coordenada(v_row.latitude_texto);
    v_lon := pedagio.parse_coordenada(v_row.longitude_texto);

    if v_data_hora is null or v_lat is null or v_lon is null
       or v_lat < -90 or v_lat > 90 or v_lon < -180 or v_lon > 180 then
      v_erros := v_erros + 1;
      continue;
    end if;

    select id into v_veiculo_id from pedagio.veiculo where tipo = 'cavalo' and upper(trim(placa)) = upper(trim(v_row.placa)) limit 1;

    if v_veiculo_id is null then
      v_erros := v_erros + 1;
      continue;
    end if;

    insert into pedagio.posicao_veiculo (veiculo_id, geom, data_hora, fonte, lote_importacao_id)
    values (
      v_veiculo_id,
      extensions.ST_SetSRID(extensions.ST_MakePoint(v_lon, v_lat), 4326),
      v_data_hora,
      'carga_arquivo',
      v_lote_id
    )
    on conflict (veiculo_id, data_hora) do nothing;

    if not found then
      v_erros := v_erros + 1;
    end if;
  end loop;

  update pedagio.lote_importacao set total_linhas = v_total, total_erros = v_erros where id = v_lote_id;

  delete from pedagio.staging_posicao_veiculo where id = any(v_ids);

  select * into v_lote from pedagio.lote_importacao where id = v_lote_id;
  return v_lote;
end;
$function$;

create or replace function pedagio.processar_staging_viagens_transporte(p_arquivo_nome text DEFAULT NULL::text, p_usuario text DEFAULT NULL::text)
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
  v_saida timestamptz;
  v_chegada timestamptz;
  v_tipo_viagem text;
  v_veiculo_id uuid;
  v_embarcador_id uuid;
  v_viagem_id uuid;
  v_lote pedagio.lote_importacao;
begin
  select array_agg(id) into v_ids from pedagio.staging_viagem_transporte;
  if v_ids is null then
    raise exception 'pedagio.staging_viagem_transporte esta vazia, nada para importar';
  end if;

  insert into pedagio.lote_importacao (tipo, arquivo_nome, usuario, total_linhas, total_erros)
  values ('viagens_transporte', p_arquivo_nome, p_usuario, array_length(v_ids, 1), 0)
  returning id into v_lote_id;

  for v_row in select * from pedagio.staging_viagem_transporte where id = any(v_ids) order by id loop
    v_total := v_total + 1;

    begin
      v_saida := pedagio.parse_data_hora_combinada(v_row.data_hora_saida_texto);
      v_chegada := pedagio.parse_data_hora_combinada(v_row.data_hora_chegada_texto);
      v_tipo_viagem := pedagio.normalizar_tipo_viagem(v_row.tipo_viagem_texto);

      if v_row.numero_transporte is null or trim(v_row.numero_transporte) = ''
        or v_row.placa is null or trim(v_row.placa) = ''
        or v_saida is null or v_chegada is null or v_tipo_viagem is null then
        v_erros := v_erros + 1;
        continue;
      end if;

      select id into v_veiculo_id from pedagio.veiculo where tipo = 'cavalo' and upper(trim(placa)) = upper(trim(v_row.placa)) limit 1;

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
        v_row.carreta1, v_row.carreta2, v_tipo_viagem, v_embarcador_id, v_lote_id
      )
      on conflict (numero_transporte) do nothing
      returning id into v_viagem_id;

      if not found then
        v_erros := v_erros + 1;
      else
        perform pedagio.revalidar_passagens_da_viagem(v_viagem_id);
      end if;
    exception when others then
      v_erros := v_erros + 1;
    end;
  end loop;

  update pedagio.lote_importacao set total_linhas = v_total, total_erros = v_erros where id = v_lote_id;

  delete from pedagio.staging_viagem_transporte where id = any(v_ids);

  select * into v_lote from pedagio.lote_importacao where id = v_lote_id;
  return v_lote;
end;
$function$;
