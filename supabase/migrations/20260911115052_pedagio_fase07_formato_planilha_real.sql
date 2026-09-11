-- FASE 07: adequação ao formato real da planilha do fornecedor (fatura, data/hora
-- separados, tipo de veículo informado, tipo de uso passagem/contrato, condição
-- débito/crédito com valor já assinado, viagem, embarcador, sentido).
-- Tabelas de movimento estavam vazias no momento desta migration (confirmado antes
-- de aplicar) — sem necessidade de backfill/migração de dados.

-- staging_passagem_pedagio: espelha as colunas cruas da planilha (ver docs/importacao.md)
alter table pedagio.staging_passagem_pedagio rename column id_externo to numero_fatura;
alter table pedagio.staging_passagem_pedagio drop column data_hora_texto;
alter table pedagio.staging_passagem_pedagio drop column documento;
alter table pedagio.staging_passagem_pedagio add column data_texto text;
alter table pedagio.staging_passagem_pedagio add column horario_texto text;
alter table pedagio.staging_passagem_pedagio add column tipo_veiculo text;
alter table pedagio.staging_passagem_pedagio add column tipo_uso_texto text;
alter table pedagio.staging_passagem_pedagio add column condicao_texto text;
alter table pedagio.staging_passagem_pedagio add column viagem text;
alter table pedagio.staging_passagem_pedagio add column embarcador text;
alter table pedagio.staging_passagem_pedagio add column sentido text;

-- passagem_pedagio: campos novos da planilha real
alter table pedagio.passagem_pedagio rename column id_externo to numero_fatura;
alter table pedagio.passagem_pedagio drop column documento_vinculado;
alter table pedagio.passagem_pedagio add column tipo_veiculo_informado text;
alter table pedagio.passagem_pedagio add column sentido_informado text;
alter table pedagio.passagem_pedagio add column viagem text;
alter table pedagio.passagem_pedagio add column embarcador text;

alter table pedagio.passagem_pedagio add column tipo_uso text not null default 'passagem'
  check (tipo_uso in ('passagem', 'contrato'));
alter table pedagio.passagem_pedagio alter column tipo_uso drop default;

alter table pedagio.passagem_pedagio add column condicao text not null default 'debito'
  check (condicao in ('debito', 'credito'));
alter table pedagio.passagem_pedagio alter column condicao drop default;

-- valor_cobrado: crédito vem negativo (confirmado pelo usuário), então o check antigo
-- (>= 0) não serve mais — substitui por um que garante o sinal bater com a condição.
alter table pedagio.passagem_pedagio drop constraint passagem_pedagio_valor_cobrado_check;
alter table pedagio.passagem_pedagio add constraint passagem_pedagio_valor_condicao_check check (
  (condicao = 'debito' and valor_cobrado >= 0) or (condicao = 'credito' and valor_cobrado <= 0)
);

-- novo status para linhas tipo_uso='contrato': entram direto como 'nao_aplicavel' e nunca
-- passam pelo motor de validação geo/tarifária da FASE 03 (funções dessa fase não mudam,
-- só nunca recebem essas linhas como 'pendente').
alter table pedagio.passagem_pedagio drop constraint passagem_pedagio_status_validacao_check;
alter table pedagio.passagem_pedagio add constraint passagem_pedagio_status_validacao_check check (
  status_validacao in (
    'pendente', 'ok', 'sem_dados_gps', 'fora_poligono', 'valor_divergente',
    'local_e_valor_divergentes', 'sem_cadastro', 'nao_aplicavel'
  )
);

-- helpers de parsing/normalização novos
create function pedagio.parse_data_hora_planilha(p_data text, p_horario text)
returns timestamptz
language plpgsql
immutable
as $$
declare
  v_data text := trim(p_data);
  v_horario text := trim(p_horario);
begin
  if v_data is null or v_data = '' or v_horario is null or v_horario = '' then
    return null;
  end if;

  begin
    return to_timestamp(v_data || ' ' || v_horario, 'DD/MM/YYYY HH24:MI:SS');
  exception when others then
    begin
      return to_timestamp(v_data || ' ' || v_horario, 'DD/MM/YYYY HH24:MI');
    exception when others then
      return null;
    end;
  end;
end;
$$;

create function pedagio.normalizar_tipo_uso(p_texto text)
returns text
language plpgsql
immutable
as $$
declare
  v_norm text := translate(upper(trim(coalesce(p_texto, ''))), 'ÁÀÂÃÉÊÍÓÔÕÚÇ', 'AAAAEEIOOOUC');
begin
  if v_norm in ('PASSAGEM', 'PASSAGENS') then
    return 'passagem';
  elsif v_norm = 'CONTRATO' then
    return 'contrato';
  else
    return null;
  end if;
end;
$$;

create function pedagio.normalizar_condicao(p_texto text)
returns text
language plpgsql
immutable
as $$
declare
  v_norm text := translate(upper(trim(coalesce(p_texto, ''))), 'ÁÀÂÃÉÊÍÓÔÕÚÇ', 'AAAAEEIOOOUC');
begin
  if v_norm = 'DEBITO' then
    return 'debito';
  elsif v_norm = 'CREDITO' then
    return 'credito';
  else
    return null;
  end if;
end;
$$;

drop function pedagio.parse_data_hora_br(text);

-- processamento da staging: monta data_hora a partir de data+horario, normaliza tipo_uso/
-- condicao, casa praça por (nome, sentido) em vez de só nome, e já grava 'nao_aplicavel'
-- para linhas de contrato em vez de deixá-las 'pendente'.
create or replace function pedagio.processar_staging_passagens(p_arquivo_nome text default null, p_usuario text default null)
returns pedagio.lote_importacao
language plpgsql
as $$
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

    v_data_hora := pedagio.parse_data_hora_planilha(v_row.data_texto, v_row.horario_texto);
    v_valor := pedagio.parse_valor_brl(v_row.valor_texto);
    v_tipo_uso := pedagio.normalizar_tipo_uso(v_row.tipo_uso_texto);
    v_condicao := pedagio.normalizar_condicao(v_row.condicao_texto);

    if v_data_hora is null or v_valor is null or v_tipo_uso is null or v_condicao is null then
      v_erros := v_erros + 1;
      continue;
    end if;

    -- sinal do valor precisa bater com a condição informada; planilha já vem correta,
    -- mas uma linha inconsistente é melhor barrada aqui do que quebrar no check da tabela
    if (v_condicao = 'debito' and v_valor < 0) or (v_condicao = 'credito' and v_valor > 0) then
      v_erros := v_erros + 1;
      continue;
    end if;

    select id into v_veiculo_id from pedagio.veiculo where upper(trim(placa)) = upper(trim(v_row.placa)) limit 1;

    select id into v_praca_id
    from pedagio.praca_pedagio
    where upper(trim(nome)) = upper(trim(coalesce(v_row.praca_nome, '')))
      and upper(trim(coalesce(sentido, ''))) = upper(trim(coalesce(v_row.sentido, '')))
    limit 1;

    v_status := case when v_tipo_uso = 'contrato' then 'nao_aplicavel' else 'pendente' end;

    insert into pedagio.passagem_pedagio (
      numero_fatura, veiculo_id, placa_informada, tipo_veiculo_informado,
      praca_id, praca_informada, sentido_informado, tipo_uso, condicao,
      data_hora, valor_cobrado, viagem, embarcador, lote_importacao_id, status_validacao
    ) values (
      v_row.numero_fatura, v_veiculo_id, v_row.placa, v_row.tipo_veiculo,
      v_praca_id, v_row.praca_nome, v_row.sentido, v_tipo_uso, v_condicao,
      v_data_hora, v_valor, v_row.viagem, v_row.embarcador, v_lote_id, v_status
    );
  end loop;

  update pedagio.lote_importacao set total_linhas = v_total, total_erros = v_erros where id = v_lote_id;

  delete from pedagio.staging_passagem_pedagio where id = any(v_ids);

  perform pedagio.processar_validacoes_pendentes();

  select * into v_lote from pedagio.lote_importacao where id = v_lote_id;
  return v_lote;
end;
$$;

alter function pedagio.parse_data_hora_planilha(text, text) set search_path = '';
alter function pedagio.normalizar_tipo_uso(text) set search_path = '';
alter function pedagio.normalizar_condicao(text) set search_path = '';
alter function pedagio.processar_staging_passagens(text, text) set search_path = '';

-- views: novos campos em vw_passagens_detalhado (colunas adicionadas ao final, não quebra
-- as views dependentes) e ajustes de escopo em três views derivadas.
create or replace view pedagio.vw_passagens_detalhado
with (security_invoker = true)
as
select
  pp.id as passagem_id,
  pp.data_hora,
  pp.veiculo_id,
  v.placa,
  pp.praca_id,
  pc.nome as praca_nome,
  pc.rodovia,
  pp.valor_cobrado,
  vp.valor_esperado,
  vp.divergencia_valor,
  pp.status_validacao,
  vp.dentro_poligono,
  vp.distancia_metros,
  vp.diferenca_segundos,
  pp.lote_importacao_id,
  pp.numero_fatura,
  pp.tipo_veiculo_informado,
  pp.sentido_informado,
  pp.tipo_uso,
  pp.condicao,
  pp.viagem,
  pp.embarcador
from pedagio.passagem_pedagio pp
left join pedagio.veiculo v on v.id = pp.veiculo_id
left join pedagio.praca_pedagio pc on pc.id = pp.praca_id
left join pedagio.validacao_passagem vp on vp.passagem_id = pp.id;

create or replace view pedagio.vw_praca_taxa_fora_poligono
with (security_invoker = true)
as
select
  praca_id,
  praca_nome,
  rodovia,
  count(*) filter (where status_validacao = 'fora_poligono') as qtd_fora_poligono,
  count(*) as qtd_total,
  round(100.0 * count(*) filter (where status_validacao = 'fora_poligono') / nullif(count(*), 0), 2) as taxa_fora_poligono_pct
from pedagio.vw_passagens_detalhado
where praca_id is not null and status_validacao <> 'nao_aplicavel'
group by 1, 2, 3
order by taxa_fora_poligono_pct desc nulls last;

create or replace view pedagio.vw_veiculo_taxa_divergencia
with (security_invoker = true)
as
select
  veiculo_id,
  placa,
  count(*) filter (where status_validacao in ('fora_poligono', 'valor_divergente', 'local_e_valor_divergentes')) as qtd_divergente,
  count(*) as qtd_total,
  round(100.0 * count(*) filter (where status_validacao in ('fora_poligono', 'valor_divergente', 'local_e_valor_divergentes')) / nullif(count(*), 0), 2) as taxa_divergencia_pct
from pedagio.vw_passagens_detalhado
where veiculo_id is not null and status_validacao <> 'nao_aplicavel'
group by 1, 2
order by taxa_divergencia_pct desc nulls last;

create or replace view pedagio.vw_volume_passagens_praca_dia
with (security_invoker = true)
as
select
  praca_id,
  praca_nome,
  date_trunc('day', data_hora) as dia,
  count(*) as qtd_passagens
from pedagio.vw_passagens_detalhado
where tipo_uso = 'passagem'
group by 1, 2, 3
order by 3, 1;
