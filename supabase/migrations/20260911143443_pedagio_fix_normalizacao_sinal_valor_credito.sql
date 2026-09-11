-- O arquivo real do fornecedor não é consistente quanto ao sinal do
-- valor: condicao_texto = CR já apareceu com valor positivo (linha
-- vinculada a um débito anterior da mesma passagem). Confirmado com o
-- usuário: crédito sempre reduz o gasto, então normaliza o sinal pela
-- condição em vez de barrar a linha como erro.

create or replace function pedagio.processar_staging_passagens(p_arquivo_nome text default null::text, p_usuario text default null::text)
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

    -- normaliza o sinal pela condição informada, em vez de barrar a linha
    -- como erro (ver nota da migration): débito sempre positivo, crédito
    -- sempre negativo, independente de como o arquivo trouxe o sinal.
    v_valor := case when v_condicao = 'debito' then abs(v_valor) else -abs(v_valor) end;

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
$function$;
