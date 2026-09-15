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

**A categoria usada na tarifa não é sempre a cadastrada no veículo.** O
cavalo mecânico sozinho não define a quantidade de eixos — depende de
quantas/quais carretas estão engatadas naquela viagem específica (uma
carreta comum = 3 eixos, vanderleia = 4 eixos; cavalo = 3 eixos fixos).
Essa informação só existe em `viagem_transporte.carreta1`/`carreta2`
(vem da importação do documento de transporte, FASE 13), não na planilha
de passagens. Por isso a categoria é resolvida em duas etapas
(`pedagio.categoria_por_composicao`, ver [modelo-dados.md](modelo-dados.md)):

1. **Composição real da viagem** (preferencial): casa a passagem (placa +
   `data_hora`) com a `viagem_transporte` cuja janela saída/chegada a
   contém (mesma heurística de desempate do vínculo de embarcador —
   `order by data_hora_saida limit 1`, já que teoricamente uma passagem
   pode cair em mais de uma janela). Soma os eixos: 3 (cavalo) +
   eixos da carreta1 + eixos da carreta2 (cadastro `pedagio.carreta`,
   ver abaixo). Categoria = `categoria_veiculo` com `codigo = 'EIXO_' ||
   total_eixos`.
2. **Fallback: categoria cadastrada do veículo** — usada sempre que a
   etapa 1 não resolver (sem viagem de transporte casando a janela, sem
   carreta1, ou carreta não cadastrada em `pedagio.carreta`). É o
   comportamento antigo (único que existia antes desse ajuste).

`validacao_passagem.origem_categoria` grava qual das duas foi usada
(`composicao_viagem` | `cadastro_veiculo`), pra dar transparência/
auditoria — fica visível na tela de detalhe da passagem e como coluna
"Categoria" (marcada "(estimado)" quando é fallback) na listagem.

Cadastro `pedagio.carreta` (placa/código → `tipo` `comum` [3 eixos] ou
`vanderleia` [4 eixos]) é gerenciado em `/cadastros/carretas`
(admin-only para escrever, leitura para qualquer usuário autorizado).

Com a categoria resolvida:

1. Buscar em `tarifa_praca` o valor vigente para `praca_id` + a
   `categoria_veiculo_id` resolvida acima onde
   `vigencia_inicio <= (passagem.data_hora at time zone 'America/Sao_Paulo')::date`
   e (`vigencia_fim is null` ou `vigencia_fim >= (passagem.data_hora at time zone 'America/Sao_Paulo')::date`).
   A data é sempre convertida para o horário local (Brasil) antes do
   cast — `data_hora` é `timestamptz` gravado em UTC, e o dia "de
   verdade" pra efeito de tarifa é o dia local, não o dia UTC.
2. Comparar com `valor_cobrado`:
   - Igual (ou dentro de uma tolerância de centavos) → ok.
   - Diferente → `divergencia_valor = valor_cobrado - valor_esperado`,
     contribui para `resultado = valor_divergente`.

**Revalidação automática:** como a composição depende de dados que
podem chegar depois da passagem (viagem de transporte importada depois,
carreta cadastrada depois), qualquer uma dessas ações revalida
automaticamente as passagens afetadas (mesmo padrão já usado quando um
ping de GPS é excluído):
- Importar uma viagem de transporte (`processar_staging_viagens_transporte`)
  revalida as passagens que passam a cair na janela dela.
- Cadastrar, alterar ou excluir uma carreta (trigger em `pedagio.carreta`)
  revalida as passagens de todas as viagens que usam aquela carreta.
- Excluir uma viagem de transporte ou um lote inteiro
  (`excluir_viagens_transporte`/`excluir_lote_importacao`) revalida as
  passagens que dependiam dela (voltam pro fallback).

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

## Validação de permanência (estacionamento, FASE 20)

Linhas `tipo_uso = 'estacionamento'` não representam uma passagem pontual
por uma praça — representam uma cobrança por período de permanência
(pernoite/diárias) num local com polígono cadastrado (`pedagio.estacionamento`).
O fluxo é bem diferente do de passagem: em vez de procurar um ping perto de
um instante único, é preciso reconstruir o período de permanência a partir
do histórico de GPS.

Parâmetros configuráveis (mesmo espírito de `janela_tolerancia_validacao`):
- `janela_busca_estacionamento()`: até onde no passado buscar o início da
  permanência a partir de `data_hora` da linha (referência, ex.: saída) —
  fixo em 30 dias.
- `gap_continuidade_estacionamento()`: gap máximo entre dois pings dentro do
  polígono para ainda considerar "o mesmo período de permanência" — fixo em
  6 horas (cobre trackers que não enviam ping com o veículo parado).

Algoritmo, por passagem (`pedagio.validar_estacionamento`):

1. Se `veiculo_id` ou `estacionamento_id` não foram resolvidos na
   importação → `status_validacao = sem_cadastro` (mesmo padrão de
   `validar_passagem`).
2. Buscar todos os `posicao_veiculo` do veículo com `data_hora` entre
   `data_hora da linha - janela_busca_estacionamento()` e
   `data_hora da linha + janela_tolerancia_validacao()`, filtrando só os
   que caem dentro do polígono do estacionamento (`ST_Contains`).
3. Agrupar esses pings em "corridas" contínuas — uma técnica de SQL
   conhecida como "gaps and islands": ordena por `data_hora`, marca como
   início de nova corrida qualquer ping cujo gap para o anterior (dentro do
   polígono) exceda `gap_continuidade_estacionamento()`, e agrega
   min/max de `data_hora` por corrida. Tudo numa única query (CTEs +
   `lag()`/`sum() over`), sem loop procedural.
4. Escolher a corrida mais relevante: a que contém `data_hora` da linha, ou
   (se nenhuma contém) a mais próxima dela no tempo.
5. Se nenhuma corrida foi encontrada → `resultado = sem_dados_gps`.
6. Caso contrário: `entrada_detectada`/`saida_detectada` = início/fim da
   corrida escolhida; `diarias_detectadas = ceil(duração / 24h)` (mínimo 1);
   busca a tarifa vigente (`tarifa_estacionamento`) na data de
   `entrada_detectada`; `valor_esperado = diarias × tarifa` (null se não há
   tarifa vigente cadastrada, mesma simplificação da FASE 03);
   `divergencia_valor = valor_cobrado - valor_esperado`; `resultado = ok` se
   a divergência é nula/zero, senão `valor_divergente`.

O resultado grava em `pedagio.validacao_estacionamento` (tabela própria, ver
[modelo-dados.md](modelo-dados.md)) e atualiza
`passagem_pedagio.status_validacao` com o mesmo `resultado` — os três
valores usados (`ok`/`sem_dados_gps`/`valor_divergente`) já existiam no
domínio da coluna, não precisou de novo valor no `check`.

**Revalidação automática:** o mesmo trigger de `posicao_veiculo` (FASE 03)
que revalida passagens `pendente`/`sem_dados_gps` ao chegar um ping novo
também cobre `tipo_uso = 'estacionamento'`, só que usando a janela de busca
de 30 dias em vez da janela pontual de passagem — um ping de GPS que chega
dias depois de uma cobrança de estacionamento ainda revalida ela
automaticamente.

**Limitação conhecida (decisão provisória):** sem arquivo real do
fornecedor ainda para confirmar o rótulo exato de `tipo_uso_texto` — o
sistema aceita `ESTACIONAMENTO` por enquanto (`normalizar_tipo_uso`), mesmo
padrão da FASE 07 (revisar quando o arquivo real chegar). Também: a regra
de diária (arredondar para cima a cada 24h) e a tolerância de gap (6h) são
decisões provisórias, sem dado real de permanência de estacionamento para
validar ainda — ver `docs/ROADMAP.md`, FASE 20.

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
