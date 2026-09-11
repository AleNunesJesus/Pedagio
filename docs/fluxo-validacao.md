# Fluxo de Validação

> FASE 07: este fluxo só se aplica a linhas com `tipo_uso = 'passagem'`.
> Linhas `tipo_uso = 'contrato'` (ajuste/lançamento contratual, sem
> passagem física por uma praça) nunca entram aqui — já são importadas
> com `status_validacao = 'nao_aplicavel'`. Ver
> [importacao.md](importacao.md).

Para cada `passagem_pedagio` pendente, o processo de validação precisa
responder duas perguntas independentes:

1. **O veículo realmente esteve na praça?** (validação geoespacial)
2. **O valor cobrado está correto?** (validação tarifária)

## 1. Validação geoespacial (polígono)

Parâmetros configuráveis:
- `janela_tempo`: tolerância em minutos ao redor de `data_hora` da passagem
  para buscar pings de GPS (sugestão inicial: ±10 min, ajustável por praça
  se necessário — praças com fila podem precisar de janela maior).

Algoritmo, por passagem:

1. Buscar todos os `posicao_veiculo` do mesmo `veiculo_id` com
   `data_hora` dentro de `[passagem.data_hora - janela_tempo, passagem.data_hora + janela_tempo]`.
2. Se não houver nenhum ping na janela → `resultado = sem_dados_gps`.
3. Entre os pings encontrados, verificar `ST_Contains(praca.poligono, ping.geom)`.
   - Se pelo menos um ping estiver dentro do polígono → pega o mais próximo
     em tempo de `passagem.data_hora`, marca `dentro_poligono = true`,
     grava `posicao_veiculo_id` e `diferenca_segundos`.
   - Se nenhum ping estiver dentro do polígono, mas existirem pings na
     janela → `dentro_poligono = false`, `resultado = fora_poligono`
     (candidato a cobrança indevida/erro de identificação de veículo),
     grava a menor `distancia_metros` até o polígono
     (`ST_Distance(praca.poligono, ping.geom)`).

Isso pode ser implementado como uma função SQL (`validar_passagem(passagem_id)`)
chamada por um job (pg_cron) processando o lote de passagens `pendente`, ou
disparada logo após cada importação.

## 2. Validação tarifária

1. Buscar em `tarifa_praca` o valor vigente para `praca_id` +
   `categoria_veiculo_id` (do veículo) onde
   `vigencia_inicio <= passagem.data_hora::date`
   e (`vigencia_fim is null` ou `vigencia_fim >= passagem.data_hora::date`).
2. Comparar com `valor_cobrado`:
   - Igual (ou dentro de uma tolerância de centavos) → ok.
   - Diferente → `divergencia_valor = valor_cobrado - valor_esperado`,
     contribui para `resultado = valor_divergente`.

## Combinando os dois resultados

| geoespacial | tarifário | `resultado` final |
|---|---|---|
| dentro do polígono | valor ok | `ok` |
| dentro do polígono | valor divergente | `valor_divergente` |
| fora do polígono (tem GPS) | valor ok | `fora_poligono` |
| fora do polígono (tem GPS) | valor divergente | `local_e_valor_divergentes` |
| sem pings na janela | — | `sem_dados_gps` |

`passagem_pedagio.status_validacao` é atualizado para o mesmo valor de
`resultado`, permitindo filtrar rapidamente sem join.

## Casos a decidir com o usuário (não bloqueiam o desenho, mas afetam a
implementação)

- Tamanho ideal da `janela_tempo` por tipo de via (rodovia livre vs. praça
  com fila).
- O que fazer quando `placa_informada` ou `praca_informada` da planilha não
  bate com nenhum cadastro (`veiculo_id`/`praca_id` nulos) — bloquear a
  linha, ou importar mesmo assim como `status_validacao = sem_cadastro`?
- Reprocessamento: se pings de GPS chegarem depois (via API) para uma
  passagem já marcada `sem_dados_gps`, o sistema deve revalidar
  automaticamente?
