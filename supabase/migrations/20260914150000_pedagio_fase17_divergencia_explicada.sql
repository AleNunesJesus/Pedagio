-- FASE 17: quebra da "Divergência total" do painel por causa (status),
-- por praça e por veículo. Hoje só existe o número líquido agregado
-- (vw_financeiro_mensal.divergencia_total = total_cobrado - total_esperado),
-- sem nenhuma view que explique de onde ele vem. Todas security_invoker=true,
-- mesma convenção das views existentes (FASE 05).

create view pedagio.vw_divergencia_por_status
with (security_invoker = true)
as
select
  status_validacao,
  count(*) as qtd_passagens,
  sum(valor_cobrado) as total_cobrado,
  sum(valor_esperado) as total_esperado,
  sum(coalesce(divergencia_valor, 0)) as divergencia_valor
from pedagio.vw_passagens_detalhado
group by 1
order by abs(sum(coalesce(divergencia_valor, 0))) desc;

comment on view pedagio.vw_divergencia_por_status is
  'Divergência (total_cobrado - total_esperado) somada por status_validacao. '
  'total_esperado null (e divergencia_valor 0) em sem_cadastro/nao_aplicavel/pendente '
  'indica passagens sem tarifa de referência calculada, não divergência zero real.';

create view pedagio.vw_divergencia_por_praca
with (security_invoker = true)
as
select
  praca_id,
  praca_nome,
  rodovia,
  count(*) as qtd_passagens,
  sum(valor_cobrado) as total_cobrado,
  sum(valor_esperado) as total_esperado,
  sum(coalesce(divergencia_valor, 0)) as divergencia_valor
from pedagio.vw_passagens_detalhado
group by 1, 2, 3
order by abs(sum(coalesce(divergencia_valor, 0))) desc;

create view pedagio.vw_divergencia_por_veiculo
with (security_invoker = true)
as
select
  veiculo_id,
  placa,
  count(*) as qtd_passagens,
  sum(valor_cobrado) as total_cobrado,
  sum(valor_esperado) as total_esperado,
  sum(coalesce(divergencia_valor, 0)) as divergencia_valor
from pedagio.vw_passagens_detalhado
group by 1, 2
order by abs(sum(coalesce(divergencia_valor, 0))) desc;
