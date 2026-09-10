-- FASE 05: views de indicadores (financeiro, auditoria/validação, operacional)
-- Todas com security_invoker=true para respeitar RLS das tabelas de base quando políticas existirem.

create view pedagio.vw_passagens_detalhado
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
  pp.lote_importacao_id
from pedagio.passagem_pedagio pp
left join pedagio.veiculo v on v.id = pp.veiculo_id
left join pedagio.praca_pedagio pc on pc.id = pp.praca_id
left join pedagio.validacao_passagem vp on vp.passagem_id = pp.id;

-- financeiro

create view pedagio.vw_financeiro_mensal
with (security_invoker = true)
as
select
  date_trunc('month', data_hora) as mes,
  count(*) as qtd_passagens,
  sum(valor_cobrado) as total_cobrado,
  sum(valor_esperado) as total_esperado,
  sum(coalesce(divergencia_valor, 0)) as divergencia_total
from pedagio.vw_passagens_detalhado
group by 1
order by 1;

create view pedagio.vw_gasto_por_veiculo_mensal
with (security_invoker = true)
as
select
  veiculo_id,
  placa,
  date_trunc('month', data_hora) as mes,
  count(*) as qtd_passagens,
  sum(valor_cobrado) as total_cobrado
from pedagio.vw_passagens_detalhado
group by 1, 2, 3
order by 3, 1;

create view pedagio.vw_gasto_por_praca
with (security_invoker = true)
as
select
  praca_id,
  praca_nome,
  rodovia,
  count(*) as qtd_passagens,
  sum(valor_cobrado) as total_cobrado
from pedagio.vw_passagens_detalhado
group by 1, 2, 3
order by total_cobrado desc nulls last;

-- auditoria / validação

create view pedagio.vw_status_resumo
with (security_invoker = true)
as
select
  status_validacao,
  count(*) as qtd,
  round(100.0 * count(*) / sum(count(*)) over (), 2) as percentual
from pedagio.passagem_pedagio
group by status_validacao;

create view pedagio.vw_praca_taxa_fora_poligono
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
where praca_id is not null
group by 1, 2, 3
order by taxa_fora_poligono_pct desc nulls last;

create view pedagio.vw_veiculo_taxa_divergencia
with (security_invoker = true)
as
select
  veiculo_id,
  placa,
  count(*) filter (where status_validacao in ('fora_poligono', 'valor_divergente', 'local_e_valor_divergentes')) as qtd_divergente,
  count(*) as qtd_total,
  round(100.0 * count(*) filter (where status_validacao in ('fora_poligono', 'valor_divergente', 'local_e_valor_divergentes')) / nullif(count(*), 0), 2) as taxa_divergencia_pct
from pedagio.vw_passagens_detalhado
where veiculo_id is not null
group by 1, 2
order by taxa_divergencia_pct desc nulls last;

create view pedagio.vw_sem_dados_gps_por_dia
with (security_invoker = true)
as
select
  date_trunc('day', data_hora) as dia,
  count(*) as qtd_sem_dados_gps
from pedagio.passagem_pedagio
where status_validacao = 'sem_dados_gps'
group by 1
order by 1;

-- operacional

create view pedagio.vw_diferenca_tempo_media_por_praca
with (security_invoker = true)
as
select
  praca_id,
  praca_nome,
  round(avg(abs(diferenca_segundos))::numeric, 1) as diferenca_media_segundos,
  count(*) as qtd
from pedagio.vw_passagens_detalhado
where diferenca_segundos is not null
group by 1, 2
order by 1;

create view pedagio.vw_volume_passagens_praca_dia
with (security_invoker = true)
as
select
  praca_id,
  praca_nome,
  date_trunc('day', data_hora) as dia,
  count(*) as qtd_passagens
from pedagio.vw_passagens_detalhado
group by 1, 2, 3
order by 3, 1;
