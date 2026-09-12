create index passagem_pedagio_numero_fatura_idx on pedagio.passagem_pedagio (numero_fatura);

create view pedagio.vw_fatura_resumo
with (security_invoker = true)
as
select
  numero_fatura,
  count(*) as qtd_total,
  count(*) filter (where tipo_uso = 'passagem') as qtd_passagem,
  count(*) filter (where tipo_uso = 'contrato') as qtd_contrato,
  sum(valor_cobrado) as valor_total,
  sum(valor_cobrado) filter (where tipo_uso = 'passagem') as valor_passagem,
  sum(valor_cobrado) filter (where tipo_uso = 'contrato') as valor_contrato,
  min(data_hora) as periodo_inicio,
  max(data_hora) as periodo_fim,
  count(*) filter (where status_validacao = 'ok') as qtd_ok,
  count(*) filter (where status_validacao = 'pendente') as qtd_pendente,
  count(*) filter (where status_validacao = 'sem_dados_gps') as qtd_sem_dados_gps,
  count(*) filter (where status_validacao = 'sem_cadastro') as qtd_sem_cadastro,
  count(*) filter (where status_validacao = 'valor_divergente') as qtd_valor_divergente,
  count(*) filter (where status_validacao = 'fora_poligono') as qtd_fora_poligono,
  count(*) filter (where status_validacao = 'local_e_valor_divergentes') as qtd_local_e_valor_divergentes,
  count(*) filter (where status_validacao = 'nao_aplicavel') as qtd_nao_aplicavel
from pedagio.passagem_pedagio
group by numero_fatura;
