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
