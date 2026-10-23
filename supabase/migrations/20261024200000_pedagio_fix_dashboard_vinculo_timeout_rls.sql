-- Fix: gráfico de valores por vínculo de viagem no Dashboard estourava o
-- statement timeout de 8 s para usuários comuns — mesmo problema da
-- 20261024190000: sob RLS, upper(trim(...)) não entra como condição de
-- índice. Usa a coluna gerada placa_norm (criada naquela migration) com
-- índice (placa_norm, data_hora_saida). Ensaio em transação com rollback:
-- 502 ms, resultado idêntico ao da view antiga.

create index viagem_transporte_placa_norm_col_saida_idx
  on pedagio.viagem_transporte (placa_norm, data_hora_saida);

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
  where vt.placa_norm = pp.placa_norm
    and pp.data_hora >= vt.data_hora_saida
    and pp.data_hora <= vt.data_hora_chegada
  order by vt.data_hora_saida
  limit 1
) matched on true
where pp.tipo_uso = 'passagem'
group by date_trunc('month', pp.data_hora), coalesce(matched.tipo_viagem, 'sem_vinculo')
order by date_trunc('month', pp.data_hora), coalesce(matched.tipo_viagem, 'sem_vinculo');
