-- FASE 10: cadastro próprio de viagem/embarcador, saindo dos campos texto
-- livre em passagem_pedagio para tabelas com FK. Auto-cadastro na
-- importação (mesmo espírito do "sem_cadastro" de veículo/praça, mas
-- aqui cria em vez de só marcar, porque não há conceito de bloqueio —
-- decisão do usuário).

create table pedagio.viagem (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  criado_em timestamptz not null default now()
);

create table pedagio.embarcador (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  cnpj text,
  criado_em timestamptz not null default now()
);

alter table pedagio.viagem enable row level security;
alter table pedagio.embarcador enable row level security;

create policy leitura_autorizados on pedagio.viagem for select using (pedagio.usuario_autorizado());
create policy insercao_autorizados on pedagio.viagem for insert with check (pedagio.usuario_autorizado());
create policy atualizacao_admin on pedagio.viagem for update using (pedagio.eh_admin()) with check (pedagio.eh_admin());
create policy exclusao_admin on pedagio.viagem for delete using (pedagio.eh_admin());

create policy leitura_autorizados on pedagio.embarcador for select using (pedagio.usuario_autorizado());
create policy insercao_autorizados on pedagio.embarcador for insert with check (pedagio.usuario_autorizado());
create policy atualizacao_admin on pedagio.embarcador for update using (pedagio.eh_admin()) with check (pedagio.eh_admin());
create policy exclusao_admin on pedagio.embarcador for delete using (pedagio.eh_admin());

-- passagem_pedagio: mesmo padrão já usado pra veículo/praça
-- (coluna "_informada" com o texto cru + coluna "_id" com o vínculo).
alter table pedagio.passagem_pedagio rename column viagem to viagem_informada;
alter table pedagio.passagem_pedagio rename column embarcador to embarcador_informada;
alter table pedagio.passagem_pedagio add column viagem_id uuid references pedagio.viagem(id);
alter table pedagio.passagem_pedagio add column embarcador_id uuid references pedagio.embarcador(id);
create index passagem_pedagio_viagem_id_idx on pedagio.passagem_pedagio (viagem_id);
create index passagem_pedagio_embarcador_id_idx on pedagio.passagem_pedagio (embarcador_id);

-- view: mantém os nomes de coluna "viagem"/"embarcador" (compat com o
-- frontend atual) e acrescenta os ids pra filtro/relatório.
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
  pp.viagem_informada as viagem,
  pp.embarcador_informada as embarcador,
  pp.viagem_id,
  pp.embarcador_id
from pedagio.passagem_pedagio pp
left join pedagio.veiculo v on v.id = pp.veiculo_id
left join pedagio.praca_pedagio pc on pc.id = pp.praca_id
left join pedagio.validacao_passagem vp on vp.passagem_id = pp.id;

-- processar_staging_passagens: auto-cadastra viagem/embarcador quando o
-- código/nome ainda não existe.
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

    v_data_hora := pedagio.parse_data_hora_planilha(v_row.data_texto, v_row.horario_texto);
    v_valor := pedagio.parse_valor_brl(v_row.valor_texto);
    v_tipo_uso := pedagio.normalizar_tipo_uso(v_row.tipo_uso_texto);
    v_condicao := pedagio.normalizar_condicao(v_row.condicao_texto);

    if v_data_hora is null or v_valor is null or v_tipo_uso is null or v_condicao is null then
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
  end loop;

  update pedagio.lote_importacao set total_linhas = v_total, total_erros = v_erros where id = v_lote_id;

  delete from pedagio.staging_passagem_pedagio where id = any(v_ids);

  perform pedagio.processar_validacoes_pendentes();

  select * into v_lote from pedagio.lote_importacao where id = v_lote_id;
  return v_lote;
end;
$function$;
