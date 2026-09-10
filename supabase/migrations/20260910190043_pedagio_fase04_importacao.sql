-- FASE 04: importação da planilha via staging table (Supabase Studio "Import data from CSV")

-- staging_passagem_pedagio: espelha as colunas cruas da planilha, tudo como texto.
-- Formatos esperados (ver docs/importacao.md):
--   data_hora_texto: 'DD/MM/YYYY HH24:MI:SS'
--   valor_texto: formato BR (vírgula decimal, ponto como milhar opcional) ex: '12,50' ou '1.234,56'
create table pedagio.staging_passagem_pedagio (
  id bigserial primary key,
  id_externo text,
  placa text,
  praca_nome text,
  data_hora_texto text,
  valor_texto text,
  documento text,
  criado_em timestamptz not null default now()
);

alter table pedagio.staging_passagem_pedagio enable row level security;

-- helpers de parsing (isolados para reuso e para ficar explícito o formato aceito)
create function pedagio.parse_valor_brl(p_texto text)
returns numeric
language plpgsql
immutable
as $$
declare
  v_limpo text := trim(p_texto);
begin
  if v_limpo is null or v_limpo = '' then
    return null;
  end if;

  if position(',' in v_limpo) > 0 then
    -- formato brasileiro: ponto = separador de milhar, vírgula = decimal
    v_limpo := replace(replace(v_limpo, '.', ''), ',', '.');
  end if;

  return v_limpo::numeric;
exception when others then
  return null;
end;
$$;

create function pedagio.parse_data_hora_br(p_texto text)
returns timestamptz
language plpgsql
immutable
as $$
declare
  v_limpo text := trim(p_texto);
begin
  if v_limpo is null or v_limpo = '' then
    return null;
  end if;

  return to_timestamp(v_limpo, 'DD/MM/YYYY HH24:MI:SS');
exception when others then
  return null;
end;
$$;

alter function pedagio.parse_valor_brl(text) set search_path = '';
alter function pedagio.parse_data_hora_br(text) set search_path = '';

-- processa tudo que estiver em staging no momento da chamada, cria um lote_importacao,
-- casa placa->veiculo e praca_nome->praca_pedagio (null quando não encontrado, vira 'sem_cadastro'
-- na validação, conforme decisão do usuário), insere em passagem_pedagio, dispara a validação em
-- lote (FASE 03) e limpa a staging ao final.
create function pedagio.processar_staging_passagens(p_arquivo_nome text default null, p_usuario text default null)
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
  v_veiculo_id uuid;
  v_praca_id uuid;
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

    v_data_hora := pedagio.parse_data_hora_br(v_row.data_hora_texto);
    v_valor := pedagio.parse_valor_brl(v_row.valor_texto);

    if v_data_hora is null or v_valor is null then
      v_erros := v_erros + 1;
      continue;
    end if;

    select id into v_veiculo_id from pedagio.veiculo where upper(trim(placa)) = upper(trim(v_row.placa)) limit 1;
    select id into v_praca_id from pedagio.praca_pedagio where upper(trim(nome)) = upper(trim(v_row.praca_nome)) limit 1;

    insert into pedagio.passagem_pedagio (
      id_externo, veiculo_id, placa_informada, praca_id, praca_informada,
      data_hora, valor_cobrado, documento_vinculado, lote_importacao_id
    ) values (
      v_row.id_externo, v_veiculo_id, v_row.placa, v_praca_id, v_row.praca_nome,
      v_data_hora, v_valor, v_row.documento, v_lote_id
    );
  end loop;

  update pedagio.lote_importacao set total_linhas = v_total, total_erros = v_erros where id = v_lote_id;

  delete from pedagio.staging_passagem_pedagio where id = any(v_ids);

  perform pedagio.processar_validacoes_pendentes();

  select * into v_lote from pedagio.lote_importacao where id = v_lote_id;
  return v_lote;
end;
$$;

alter function pedagio.processar_staging_passagens(text, text) set search_path = '';
