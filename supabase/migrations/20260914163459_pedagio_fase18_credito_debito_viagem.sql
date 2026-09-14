-- FASE 18: diferença entre o crédito do embarcador e o débito da praça,
-- por viagem/embarcador. O embarcador credita um valor (adiantamento) que
-- deveria ser exatamente compensado pelo débito real na praça; quando os
-- dois valores não coincidem, sobra uma diferença (ganho ou prejuízo) que
-- hoje não é apurada em nenhum lugar do sistema.
--
-- Só considera tipo_uso = 'passagem' (decisão do usuário) e só linhas com
-- viagem_id e embarcador_id resolvidos (sem isso não há o que comparar).

create view pedagio.vw_credito_debito_por_viagem
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
  sum(pp.valor_cobrado) as diferenca
from pedagio.passagem_pedagio pp
join pedagio.viagem v on v.id = pp.viagem_id
join pedagio.embarcador e on e.id = pp.embarcador_id
where pp.tipo_uso = 'passagem'
group by v.id, v.numero, e.id, e.nome
order by abs(sum(pp.valor_cobrado)) desc;

comment on view pedagio.vw_credito_debito_por_viagem is
  'valor_credito e valor_debito sempre positivos (valor_credito já invertido '
  'de sinal). diferenca = valor_debito - valor_credito: positivo é a praça '
  'debitando mais do que o embarcador creditou (prejuízo), negativo é o '
  'embarcador creditando mais do que foi debitado (ganho).';
