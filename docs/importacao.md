# Importação da Planilha de Passagens

Desde a FASE 06.5, a forma normal de importar é pela tela **Importação**
do próprio app (`/importacao`): escolha o CSV e clique em Importar — o
app lê o arquivo, grava na staging e chama `processar_staging_passagens`
automaticamente, mostrando o total de linhas/erros do lote.

O caminho manual via Supabase Studio (abaixo) continua funcionando e é
útil para cargas muito grandes ou para depuração direto no banco.

## Formato da planilha (FASE 07 — layout real do fornecedor)

O CSV precisa ter exatamente estas colunas (nomes e formatos), na ordem
em que a planilha do fornecedor as traz:

| coluna | formato esperado | exemplo |
|---|---|---|
| `numero_fatura` | texto livre (número da fatura) | `NF-000456` |
| `data_texto` | **`DD/MM/YYYY`** | `05/08/2026` |
| `horario_texto` | `HH24:MI:SS` ou `HH24:MI` | `14:32:00` ou `14:32` |
| `placa` | texto | `ABC1D23` |
| `tipo_veiculo` | texto livre, apenas informativo (a tarifa usa a categoria já cadastrada do veículo, não este campo) | `Caminhão` |
| `praca_nome` | precisa bater com `pedagio.praca_pedagio.nome` **e** `sentido` juntos (case-insensitive, espaços nas pontas ignorados) | `Praça KM 45 - BR-101` |
| `tipo_uso_texto` | `passagem`/`passagens`, `contrato` ou `plano contratado` (case-insensitive) | `passagem` |
| `valor_texto` | formato BR: vírgula decimal, ponto como milhar (opcional); também aceita ponto decimal simples (`3.5`) quando não há vírgula. **O sinal é normalizado pela `condicao_texto` na importação — débito sempre fica positivo, crédito sempre negativo, independente do sinal que vier no arquivo** | `12,50`, `-30,00` ou `23` |
| `condicao_texto` | `debito`/`db` ou `credito`/`cr` (com ou sem acento, case-insensitive) | `debito` ou `DB` |
| `viagem` | texto livre, opcional — preenchido quando o crédito é lançado direto para uma viagem. Auto-cadastrado em `pedagio.viagem` na importação (FASE 10) se ainda não existir | `VIAGEM-9` |
| `embarcador` | texto livre, opcional — quem lançou o crédito da viagem. Auto-cadastrado em `pedagio.embarcador` na importação (FASE 10) se ainda não existir; CNPJ (opcional) só é preenchido manualmente depois, em `/cadastros/embarcadores` | `Embarcador X` |
| `sentido` | texto — usado junto com `praca_nome` para casar com o cadastro da praça | `Norte` |

Qualquer linha com `data_texto`/`horario_texto`/`valor_texto` fora do
formato, `tipo_uso_texto`/`condicao_texto` não reconhecidos (fora dos
valores listados na tabela acima), ou `praca_nome`/`sentido` vazios, é
contada como erro (`total_erros` do lote) e **não** é importada — não há
tentativa de adivinhar formatos alternativos além dos já mapeados, para
não arriscar interpretar um dado errado silenciosamente. O sinal do valor
**não** é motivo de erro: é sempre normalizado pela condição (ver tabela
acima), porque o arquivo real do fornecedor não é consistente nisso — já
apareceu linha de crédito com valor positivo.

Qualquer outro erro inesperado ao processar uma linha (ex.: violação de
constraint não prevista pelas checagens acima) também é contado como erro
daquela linha, e nunca aborta o lote inteiro — uma linha ruim não pode
travar as demais nem deixar lixo na staging.

### Duplicidade

Reenviar o mesmo arquivo (ou uma linha já importada antes) é seguro: uma
linha com a mesma combinação de `placa` + `data_hora` + `condicao` +
`valor_cobrado` de uma passagem já existente é contada como erro do lote
e **não** cria uma linha nova. Débito e crédito pareados na mesma
passagem (mesma placa/horário) continuam sendo tratados como linhas
diferentes, já que têm condição/valor distintos.

**Limitação conhecida:** se o fornecedor reemitir a mesma fatura
corrigida mas mantendo veículo, horário, condição e valor idênticos ao
original, a linha corrigida seria ignorada como se fosse duplicata. Não
apareceu esse caso na prática ainda — se aparecer, revisar a chave de
deduplicação (hoje não inclui `numero_fatura`).

### `tipo_uso_texto = contrato`

Linhas de contrato não representam uma passagem física por uma praça
(ex.: ajuste/lançamento contratual). Elas são importadas normalmente,
mas entram direto com `status_validacao = 'nao_aplicavel'` e **nunca**
passam pelo motor de validação geoespacial/tarifária (FASE 03) — não faz
sentido cruzar polígono/GPS para uma linha que não é uma passagem real.
Só `tipo_uso_texto = passagem`/`passagens` é validado geograficamente.

## Passo a passo (via Supabase Studio, caminho manual)

1. Prepare o CSV com as colunas da tabela acima.

2. No Supabase Studio: Table Editor → schema `pedagio` → tabela
   `staging_passagem_pedagio` → Insert → Import data from CSV. Confirme
   que os cabeçalhos do CSV batem com os nomes das colunas acima.

3. No SQL Editor, rode:

   ```sql
   select * from pedagio.processar_staging_passagens('nome_do_arquivo.csv', 'seu_nome');
   ```

   Isso, em uma única transação:
   - cria um `lote_importacao` para rastrear a carga;
   - tenta casar `placa` → `veiculo` e (`praca_nome`, `sentido`) →
     `praca_pedagio` (case-insensitive); quando não encontra, a linha é
     importada mesmo assim com `status_validacao = 'sem_cadastro'`
     (decisão do usuário — nada da planilha se perde, só fica marcado
     para revisão);
   - roda a validação geoespacial/tarifária (FASE 03) em todas as
     passagens recém-importadas com `tipo_uso = 'passagem'`;
   - limpa a `staging_passagem_pedagio` ao final.

4. O retorno da função é a linha de `lote_importacao` — confira
   `total_linhas` vs. `total_erros`. Para investigar os resultados:

   ```sql
   select status_validacao, count(*)
   from pedagio.passagem_pedagio
   where lote_importacao_id = '<id do lote retornado>'
   group by status_validacao;
   ```

## Corrigindo um `sem_cadastro`

Depois de cadastrar o veículo/praça que faltava, revalide manualmente as
passagens que ficaram órfãs:

```sql
update pedagio.passagem_pedagio
set veiculo_id = (select id from pedagio.veiculo where placa = 'ABC1D23'),
    status_validacao = 'pendente'
where placa_informada = 'ABC1D23' and status_validacao = 'sem_cadastro'
  and tipo_uso = 'passagem';

select pedagio.processar_validacoes_pendentes();
```

## Posições de GPS (carga em lote — FASE 09)

Mesmo padrão da importação de passagens: tela **Importação** (`/importacao`)
→ seção "Nova importação de posições de GPS" → escolhe o CSV → o app grava
na staging e chama `processar_staging_posicoes` automaticamente. Ao
importar, os pings novos disparam a revalidação automática (FASE 03) das
passagens `pendente`/`sem_dados_gps` do mesmo veículo que caírem dentro da
janela de tolerância — não é preciso rodar nada manualmente depois.

### Formato do arquivo

| coluna | formato esperado | exemplo |
|---|---|---|
| `placa` | texto | `URS4D35` |
| `latitude` | graus decimais (`-90` a `90`) | `-29.8807867` |
| `longitude` | graus decimais (`-180` a `180`) | `-51.1899153` |
| `data` | **`DD/MM/YYYY`** | `31/08/2026` |
| `horario` | `HH24:MI:SS` ou `HH24:MI` | `10:00:20` |

Uma linha conta como erro (`total_erros` do lote) e **não** é importada
quando: `data`/`horario`/`latitude`/`longitude` estão fora do formato ou
fora do intervalo válido, a `placa` não corresponde a nenhum veículo
cadastrado (diferente da importação de passagens, aqui não existe um
status "sem cadastro" — o vínculo com o veículo é obrigatório), ou o ping
é duplicado (mesmo veículo + mesmo horário já importado antes — a
importação pode ser reenviada sem medo de duplicar dado).

`fonte` é sempre gravado como `carga_arquivo` nessa importação — o valor
`api` no mesmo campo fica reservado para uma eventual integração direta
com o provedor de rastreamento no futuro.

### Caminho manual (Supabase Studio)

Mesmo fluxo do de passagens: importe o CSV na tabela
`pedagio.staging_posicao_veiculo` (Table Editor → Insert → Import data
from CSV, com as colunas da tabela acima) e rode:

```sql
select * from pedagio.processar_staging_posicoes('nome_do_arquivo.csv', 'seu_nome');
```

## Viagens de transporte / documento fiscal (carga em lote — FASE 13)

Mesmo padrão das demais: tela **Importação** (`/importacao`) → seção
"Nova importação de viagens (documento fiscal)" → escolhe o CSV → o app
grava na staging e chama `processar_staging_viagens_transporte`
automaticamente. Consulta pela tela **Viagens** (`/viagens-transporte`).

Essa é uma entidade independente de `pedagio.viagem` (a tabela
auto-cadastrada a partir do campo `viagem` da planilha de passagens) —
`numero_transporte` não é a mesma numeração de `viagem_informada`, são
conceitos diferentes vindos de sistemas diferentes.

### Formato do arquivo

| coluna | formato esperado | exemplo |
|---|---|---|
| `placa` | texto | `UGF9B40` |
| `numero_transporte` | texto livre (número do documento fiscal/transporte), único | `26232` |
| `cidade_origem` | texto | `PORTO ALEGRE` |
| `uf_origem` | texto | `RS` |
| `cidade_destino` | texto | `SÃO PAULO` |
| `uf_destino` | texto | `SP` |
| `data_hora_saida` | **`DD/MM/YYYY HH24:MI`** (data e hora num único campo, diferente das outras planilhas) | `30/08/2026 10:00` |
| `data_hora_chegada` | mesmo formato de `data_hora_saida` | `01/09/2026 18:00` |
| `carreta1` | texto livre (placa/código da carreta), opcional — indica configuração de 6/7 eixos quando preenchido | `ABC1234` |
| `carreta2` | texto livre, opcional — indica configuração de 9 eixos quando preenchido (junto com `carreta1`) | vazio |
| `tipo_viagem` | `carregado` ou `vazio` (aceita também `carregada`/`vazia`, com ou sem acento, case-insensitive) | `CARREGADO` |

Não existe coluna de embarcador nesta planilha — o `embarcador_id` é
descoberto automaticamente cruzando `placa` + a janela
`data_hora_saida`/`data_hora_chegada` contra as passagens de pedágio
(`passagem_pedagio.embarcador_informada`) do mesmo veículo naquele
período. Se nenhuma passagem com embarcador cair dentro da janela, o
campo fica `null` — não é erro, só fica sem embarcador identificado.

Uma linha conta como erro (`total_erros` do lote) e **não** é importada
quando: `numero_transporte`/`placa` estão vazios, `data_hora_saida`/
`data_hora_chegada` estão fora do formato, `tipo_viagem` não é
reconhecido, ou o `numero_transporte` já existe (duplicidade — reenviar
o mesmo arquivo é seguro, não duplica). Placa não cadastrada **não** é
erro (mesmo espírito do "sem_cadastro" de passagens): a viagem é
importada mesmo assim, só sem `veiculo_id`.

### Caminho manual (Supabase Studio)

Mesmo fluxo das demais: importe o CSV na tabela
`pedagio.staging_viagem_transporte` (colunas da tabela acima, exceto que
`data_hora_saida`/`data_hora_chegada`/`tipo_viagem` viram
`data_hora_saida_texto`/`data_hora_chegada_texto`/`tipo_viagem_texto` na
staging) e rode:

```sql
select * from pedagio.processar_staging_viagens_transporte('nome_do_arquivo.csv', 'seu_nome');
```
