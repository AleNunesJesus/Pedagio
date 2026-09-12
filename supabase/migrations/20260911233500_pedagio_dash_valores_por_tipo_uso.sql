create or replace view pedagio.vw_valores_por_tipo_uso_mensal
with (security_invoker = true) as
select
  date_trunc('month', data_hora) as mes,
  tipo_uso,
  count(*) as qtd_passagens,
  sum(valor_cobrado) as total_cobrado
from pedagio.vw_passagens_detalhado
group by date_trunc('month', data_hora), tipo_uso
order by 1, 2;
