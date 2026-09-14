# Indicadores e Painéis

Todos calculáveis diretamente sobre `passagem_pedagio` + `validacao_passagem`,
com filtros por período, praça, veículo/frota.

## Financeiro

- **Valor total cobrado vs. valor esperado** (por período) — mostra o
  tamanho da divergência financeira agregada.
- **Economia/prejuízo identificado**: soma de `divergencia_valor` (positivo
  = cobrado a mais, negativo = cobrado a menos).
- **Gasto por veículo/frota ao longo do tempo** (série temporal).
- **Gasto por praça/rodovia** — ranking das praças mais custosas.
- **Resumo por fatura** (`vw_fatura_resumo`, FASE 15) — valor total líquido a
  pagar, período coberto (min/max `data_hora`), breakdown passagem vs.
  contrato e contagem por `status_validacao`, para avaliar cada fatura
  antes de pagar. Agrupa por `numero_fatura`, com `numero_fatura is null`
  virando um bucket "sem fatura" (GROUP BY já trata todos os `null` como um
  único grupo). Tela: `/faturas` (lista) e `/faturas/[numero]` (detalhe,
  incluindo breakdown por praça/veículo e as passagens da fatura).
- **Divergência explicada** (`vw_divergencia_por_status`,
  `vw_divergencia_por_praca`, `vw_divergencia_por_veiculo`, FASE 17) — quebra
  o número agregado do card "Divergência total" do Painel em causa (status
  de validação) e concentração (praça/veículo, top 5 por maior desvio em
  módulo). `total_esperado = null` numa dessas views não é "esperado zero":
  é sinal de que a passagem (`sem_cadastro`, `nao_aplicavel`, `pendente`)
  nunca teve tarifa de referência calculada, então seu `total_cobrado` não
  contribui para a divergência líquida mesmo representando risco financeiro
  não conferido.
- **Crédito x débito por viagem** (`vw_credito_debito_por_viagem`, FASE 18) —
  quando o embarcador credita um valor (adiantamento) e a praça debita
  outro pela mesma viagem, a diferença entre os dois é ganho ou prejuízo
  não apurado em lugar nenhum antes desta view. Agrupa por
  (`viagem_id`, `embarcador_id`), só `tipo_uso = passagem` e só linhas com
  viagem e embarcador identificados (sem isso não há o que comparar).
  `diferenca = valor_debito - valor_credito`: positivo é a praça debitando
  mais do que foi creditado (prejuízo), negativo é o embarcador creditando
  mais do que foi debitado (ganho). Painel mostra o agregado + top 5 em
  módulo; `/credito-debito` lista todas as viagens com filtro por
  embarcador/viagem.

## Auditoria / Validação

- **% de passagens por `resultado`** (`ok`, `sem_dados_gps`,
  `fora_poligono`, `valor_divergente`, `local_e_valor_divergentes`) — visão
  geral de saúde da conciliação.
- **Praças com maior taxa de `fora_poligono`** — pode indicar polígono mal
  cadastrado (revisar geometria) ou cobrança indevida sistemática.
- **Veículos com maior taxa de divergência** — candidatos a investigação
  (possível erro de tag/tag clonada).
- **Passagens `sem_dados_gps`** ao longo do tempo — indica falha na coleta
  de GPS (gap de rastreamento) mais do que fraude; útil para cobrar o
  provedor de rastreamento.

## Operacional

- **Tempo médio entre a passagem oficial e o ping de GPS mais próximo**
  (`diferenca_segundos` médio) — qualidade da granularidade do GPS.
- **Volume de passagens por praça/dia** — padrão de uso.
- **Mapa** com polígonos das praças e pings de GPS sobrepostos (útil para
  inspecionar visualmente casos `fora_poligono`).

## Observação

Esses indicadores dependem só do modelo já desenhado — não exigem tabelas
extras. Uma vez com o schema aplicado, a maioria vira uma `view` ou
`materialized view` simples sobre `validacao_passagem` join
`passagem_pedagio`.
