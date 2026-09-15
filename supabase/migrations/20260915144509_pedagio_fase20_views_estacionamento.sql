-- FASE 20 (continuação): views passam a considerar tipo_uso='estacionamento'.
-- Colunas novas sempre anexadas ao final (create or replace view não permite
-- inserir/reordenar no meio — mesmo achado técnico da FASE 19).

-- vw_passagens_detalhado: valor_esperado/divergencia_valor passam a vir de
-- qualquer uma das duas tabelas de validação (coalesce — cada passagem só
-- tem linha em uma das duas, nunca nas duas), e ganha os campos específicos
-- de permanência pro detalhe de estacionamento.
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
  coalesce(vp.valor_esperado, ve.valor_esperado) as valor_esperado,
  coalesce(vp.divergencia_valor, ve.divergencia_valor) as divergencia_valor,
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
  pp.embarcador_id,
  vp.posicao_veiculo_id,
  vp.categoria_veiculo_id,
  vp.origem_categoria,
  cv.codigo as categoria_codigo,
  cv.descricao as categoria_descricao,
  pp.estacionamento_id,
  est.nome as estacionamento_nome,
  ve.entrada_detectada,
  ve.saida_detectada,
  ve.diarias_detectadas
from pedagio.passagem_pedagio pp
left join pedagio.veiculo v on v.id = pp.veiculo_id
left join pedagio.praca_pedagio pc on pc.id = pp.praca_id
left join pedagio.validacao_passagem vp on vp.passagem_id = pp.id
left join pedagio.categoria_veiculo cv on cv.id = vp.categoria_veiculo_id
left join pedagio.validacao_estacionamento ve on ve.passagem_id = pp.id
left join pedagio.estacionamento est on est.id = pp.estacionamento_id;

-- vw_fatura_resumo: breakdown por tipo_uso ganha estacionamento (qtd_total/
-- valor_total já somavam todos os tipos, incluindo estacionamento, desde
-- sempre — só faltava a coluna própria de breakdown, mesmo padrão de
-- qtd_passagem/qtd_contrato).
create or replace view pedagio.vw_fatura_resumo
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
  count(*) filter (where status_validacao = 'nao_aplicavel') as qtd_nao_aplicavel,
  count(*) filter (where tipo_uso = 'estacionamento') as qtd_estacionamento,
  sum(valor_cobrado) filter (where tipo_uso = 'estacionamento') as valor_estacionamento
from pedagio.passagem_pedagio
group by numero_fatura;
