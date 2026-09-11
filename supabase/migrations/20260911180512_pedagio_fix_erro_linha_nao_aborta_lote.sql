-- Bug real: a primeira linha de um arquivo real chegou na staging sem
-- praca_nome/sentido. Isso violava a constraint not null de
-- passagem_pedagio.praca_informada e lançava uma excecao não tratada, que
-- abortava a transação inteira (lote_importacao nem chegava a ser
-- confirmado) e, pior, NÃO limpava a staging_passagem_pedagio (o insert na
-- staging é uma chamada separada, fora da transação da função). Resultado:
-- toda nova tentativa de reimportar reprocessava as linhas antigas
-- acumuladas junto com as novas, sempre falhando no mesmo ponto.
--
-- Fix: qualquer erro inesperado ao processar uma linha (constraint
-- violation, etc.) agora é capturado e contado como erro daquela linha
-- (mesmo padrão já usado para data/valor/tipo_uso/condicao invalidos),
-- em vez de abortar o lote inteiro.
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

      select id into v_veiculo_id from pedagio.veiculo where upper(trim(placa)) = upper(trim(v_row.placa)) limit 1;

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
