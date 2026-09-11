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
| `tipo_uso_texto` | `passagem`/`passagens` ou `contrato` | `passagem` |
| `valor_texto` | formato BR: vírgula decimal, ponto como milhar (opcional). **Já vem negativo quando `condicao_texto = credito`** | `12,50` ou `-30,00` |
| `condicao_texto` | `debito` ou `credito` (com ou sem acento) | `debito` |
| `viagem` | texto livre, opcional — preenchido quando o crédito é lançado direto para uma viagem | `VIAGEM-9` |
| `embarcador` | texto livre, opcional — quem lançou o crédito da viagem | `Embarcador X` |
| `sentido` | texto — usado junto com `praca_nome` para casar com o cadastro da praça | `Norte` |

Qualquer linha com `data_texto`/`horario_texto`/`valor_texto` fora do
formato, ou `tipo_uso_texto`/`condicao_texto` não reconhecidos, ou sinal
do valor inconsistente com a condição informada (débito negativo ou
crédito positivo), é contada como erro (`total_erros` do lote) e **não**
é importada — não há tentativa de adivinhar formatos alternativos, para
não arriscar interpretar um dado errado silenciosamente.

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

## Posições de GPS (carga em lote)

Este documento cobre a importação de **passagens**. A carga em lote de
`posicao_veiculo` (antes da API existir) segue o mesmo padrão de staging,
mas ainda não tem uma tabela/função dedicada — avaliar se vale a pena
replicar esta mesma abordagem quando a necessidade aparecer.
