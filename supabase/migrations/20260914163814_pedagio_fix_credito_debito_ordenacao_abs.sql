-- Fix: PostgREST não aceita abs(coluna) como alvo de .order() — a view
-- precisa expor a diferença em módulo como uma coluna própria pra permitir
-- ordenação explícita nas queries do app (paginação de /credito-debito).

create or replace view pedagio.vw_credito_debito_por_viagem
with (security_invoker = true)
as
select
  v.id as viagem_id,
  v.numero as viagem_numero,
  e.id as embarcador_id,
  e.nome as embarcador_nome,
  count(*) filter (where pp.condicao = 'credito') as qtd_credito,
  count(*) filter (where pp.condicao = 'debito') as qtd_debito,
  coalesce(-sum(pp.valor_cobrado) filter (where pp.condicao = 'credito'), 0) as valor_credito,
  coalesce(sum(pp.valor_cobrado) filter (where pp.condicao = 'debito'), 0) as valor_debito,
  sum(pp.valor_cobrado) as diferenca,
  abs(sum(pp.valor_cobrado)) as diferenca_abs
from pedagio.passagem_pedagio pp
join pedagio.viagem v on v.id = pp.viagem_id
join pedagio.embarcador e on e.id = pp.embarcador_id
where pp.tipo_uso = 'passagem'
group by v.id, v.numero, e.id, e.nome
order by diferenca_abs desc;
