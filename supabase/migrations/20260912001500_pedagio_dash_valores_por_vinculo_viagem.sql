create or replace view pedagio.vw_valores_por_vinculo_viagem_mensal
with (security_invoker = true) as
select
  date_trunc('month', pp.data_hora) as mes,
  coalesce(matched.tipo_viagem, 'sem_vinculo') as vinculo,
  count(*) as qtd_passagens,
  sum(pp.valor_cobrado) as total_cobrado
from pedagio.passagem_pedagio pp
left join lateral (
  select vt.tipo_viagem
  from pedagio.viagem_transporte vt
  where upper(trim(vt.placa_informada)) = upper(trim(pp.placa_informada))
    and pp.data_hora between vt.data_hora_saida and vt.data_hora_chegada
  order by vt.data_hora_saida
  limit 1
) matched on true
where pp.tipo_uso = 'passagem'
group by date_trunc('month', pp.data_hora), coalesce(matched.tipo_viagem, 'sem_vinculo')
order by 1, 2;
