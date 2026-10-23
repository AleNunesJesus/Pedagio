-- Fix: tela de Viagens vinha vazia (statement timeout de 8 s) para usuários
-- comuns. Sob RLS, o Postgres não aceita upper(trim(...)) — função não
-- leakproof — como condição de índice; o LATERAL da view só usava a faixa
-- de data_hora e varria todas as passagens do período para cada viagem.
-- Como postgres (sem RLS) a mesma consulta levava ~30 ms.
--
-- Solução: placa normalizada em coluna gerada nas duas tabelas e índice
-- (placa_norm, data_hora); a view compara texto com texto (texteq é
-- leakproof), que entra no índice mesmo com RLS. Ensaio em transação com
-- rollback: 50–180 ms, resultados idênticos aos da view antiga.

alter table pedagio.passagem_pedagio
  add column placa_norm text generated always as (upper(trim(placa_informada))) stored;

alter table pedagio.viagem_transporte
  add column placa_norm text generated always as (upper(trim(placa_informada))) stored;

create index passagem_pedagio_placa_norm_col_data_idx
  on pedagio.passagem_pedagio (placa_norm, data_hora);

create or replace view pedagio.vw_viagem_transporte_detalhado
with (security_invoker = true) as
select
  vt.id,
  vt.numero_transporte,
  vt.veiculo_id,
  vt.placa_informada,
  vt.cidade_origem,
  vt.uf_origem,
  vt.cidade_destino,
  vt.uf_destino,
  vt.data_hora_saida,
  vt.data_hora_chegada,
  vt.carreta1,
  vt.carreta2,
  vt.tipo_viagem,
  vt.embarcador_id,
  e.nome as embarcador_nome,
  vt.lote_importacao_id,
  vt.created_at,
  coalesce(p.valor_pedagios, 0) as valor_pedagios,
  coalesce(p.valor_tarifa_esperada, 0) as valor_tarifa_esperada,
  coalesce(p.valor_pedagios, 0) - coalesce(p.valor_tarifa_esperada, 0) as divergencia_valor,
  coalesce(p.valor_pedagios_confirmado, 0) as valor_pedagios_confirmado,
  coalesce(p.valor_pedagios_estimado, 0) as valor_pedagios_estimado,
  v.frota
from pedagio.viagem_transporte vt
left join pedagio.embarcador e on e.id = vt.embarcador_id
left join pedagio.veiculo v on v.id = vt.veiculo_id
left join lateral (
  select
    sum(pp.valor_cobrado) as valor_pedagios,
    sum(pp.valor_cobrado) filter (where vp.dentro_poligono) as valor_pedagios_confirmado,
    sum(pp.valor_cobrado) filter (where vp.dentro_poligono is distinct from true) as valor_pedagios_estimado,
    sum(vp.valor_esperado) as valor_tarifa_esperada
  from pedagio.passagem_pedagio pp
  left join pedagio.validacao_passagem vp on vp.passagem_id = pp.id
  where pp.placa_norm = vt.placa_norm
    and pp.tipo_uso = 'passagem'
    and pp.data_hora >= vt.data_hora_saida
    and pp.data_hora <= vt.data_hora_chegada
) p on true;
