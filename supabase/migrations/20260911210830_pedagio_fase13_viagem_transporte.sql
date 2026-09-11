-- FASE 13: viagem completa (documento fiscal de transporte) — tabela
-- nova e independente de pedagio.viagem (numeração e conceito
-- diferentes: numero_transporte não é o mesmo número que viagem_informada
-- em passagem_pedagio).

alter table pedagio.lote_importacao drop constraint lote_importacao_tipo_check;
alter table pedagio.lote_importacao add constraint lote_importacao_tipo_check
  check (tipo = any (array['passagens', 'posicoes_gps', 'viagens_transporte']));

create table pedagio.viagem_transporte (
  id uuid primary key default gen_random_uuid(),
  numero_transporte text not null unique,
  veiculo_id uuid references pedagio.veiculo(id),
  placa_informada text not null,
  cidade_origem text,
  uf_origem text,
  cidade_destino text,
  uf_destino text,
  data_hora_saida timestamptz not null,
  data_hora_chegada timestamptz not null,
  carreta1 text,
  carreta2 text,
  tipo_viagem text not null,
  embarcador_id uuid references pedagio.embarcador(id),
  lote_importacao_id uuid references pedagio.lote_importacao(id),
  created_at timestamptz not null default now()
);

create index viagem_transporte_veiculo_id_idx on pedagio.viagem_transporte (veiculo_id);
create index viagem_transporte_embarcador_id_idx on pedagio.viagem_transporte (embarcador_id);

alter table pedagio.viagem_transporte enable row level security;

create policy leitura_autorizados on pedagio.viagem_transporte for select using (pedagio.usuario_autorizado());
create policy insercao_autorizados on pedagio.viagem_transporte for insert with check (pedagio.usuario_autorizado());
create policy atualizacao_admin on pedagio.viagem_transporte for update using (pedagio.eh_admin()) with check (pedagio.eh_admin());
create policy exclusao_admin on pedagio.viagem_transporte for delete using (pedagio.eh_admin());

create table pedagio.staging_viagem_transporte (
  id bigint generated always as identity primary key,
  placa text,
  numero_transporte text,
  cidade_origem text,
  uf_origem text,
  cidade_destino text,
  uf_destino text,
  data_hora_saida_texto text,
  data_hora_chegada_texto text,
  carreta1 text,
  carreta2 text,
  tipo_viagem_texto text,
  criado_em timestamptz not null default now()
);

alter table pedagio.staging_viagem_transporte enable row level security;

create policy acesso_autorizados on pedagio.staging_viagem_transporte
  for all using (pedagio.usuario_autorizado()) with check (pedagio.usuario_autorizado());

-- data_hora_saida/chegada vêm num único campo "DD/MM/YYYY HH24:MI" (ou com
-- segundos), diferente do padrão data+horário separados das outras
-- planilhas. Mesmo tratamento de fuso do fix pós-FASE04/09: interpreta
-- como horário local (Brasil) e converte certo pra UTC.
create or replace function pedagio.parse_data_hora_combinada(p_texto text)
returns timestamptz
language plpgsql
immutable
set search_path to ''
as $function$
declare
  v_texto text := trim(p_texto);
begin
  if v_texto is null or v_texto = '' then
    return null;
  end if;

  begin
    return (to_timestamp(v_texto, 'DD/MM/YYYY HH24:MI:SS')::timestamp) at time zone 'America/Sao_Paulo';
  exception when others then
    begin
      return (to_timestamp(v_texto, 'DD/MM/YYYY HH24:MI')::timestamp) at time zone 'America/Sao_Paulo';
    exception when others then
      return null;
    end;
  end;
end;
$function$;

-- Aceita carregado/vazio (masculino, forma real do fornecedor) e
-- carregada/vazia (feminino) por segurança, case-insensitive.
create or replace function pedagio.normalizar_tipo_viagem(p_texto text)
returns text
language sql
immutable
set search_path to ''
as $function$
  select case lower(trim(p_texto))
    when 'carregado' then 'carregado'
    when 'carregada' then 'carregado'
    when 'vazio' then 'vazio'
    when 'vazia' then 'vazio'
    else null
  end;
$function$;

create or replace function pedagio.processar_staging_viagens_transporte(p_arquivo_nome text default null::text, p_usuario text default null::text)
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

      select id into v_veiculo_id from pedagio.veiculo where upper(trim(placa)) = upper(trim(v_row.placa)) limit 1;

      -- embarcador não vem nesta planilha: descoberto cruzando placa +
      -- janela saída/chegada contra as passagens de pedágio do período.
      select embarcador_id into v_embarcador_id
      from pedagio.passagem_pedagio
      where upper(trim(placa_informada)) = upper(trim(v_row.placa))
        and data_hora between v_saida and v_chegada
        and embarcador_id is not null
      order by data_hora
      limit 1;

      insert into pedagio.viagem_transporte (
        numero_transporte, veiculo_id, placa_informada, cidade_origem, uf_origem,
        cidade_destino, uf_destino, data_hora_saida, data_hora_chegada,
        carreta1, carreta2, tipo_viagem, embarcador_id, lote_importacao_id
      ) values (
        trim(v_row.numero_transporte), v_veiculo_id, v_row.placa, v_row.cidade_origem, v_row.uf_origem,
        v_row.cidade_destino, v_row.uf_destino, v_saida, v_chegada,
        v_row.carreta1, v_row.carreta2, v_tipo_viagem, v_embarcador_id, v_lote_id
      )
      on conflict (numero_transporte) do nothing;

      if not found then
        v_erros := v_erros + 1;
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
