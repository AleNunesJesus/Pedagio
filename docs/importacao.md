# Importação da Planilha de Passagens

Enquanto não existe tela de upload (FASE 06), a planilha é carregada por
uma tabela de staging + o recurso nativo do Supabase Studio de importar
CSV direto numa tabela.

## Passo a passo

1. Prepare o CSV com exatamente estas colunas (nomes e formatos):

   | coluna | formato esperado | exemplo |
   |---|---|---|
   | `id_externo` | texto livre (id da linha na planilha original) | `PASS-00123` |
   | `placa` | texto | `ABC1D23` |
   | `praca_nome` | texto — precisa bater com `pedagio.praca_pedagio.nome` (case-insensitive, espaços nas pontas ignorados) | `Praça KM 45 - BR-101` |
   | `data_hora_texto` | **`DD/MM/YYYY HH24:MI:SS`** | `01/08/2026 14:32:00` |
   | `valor_texto` | formato BR: vírgula decimal, ponto como milhar (opcional) | `12,50` ou `1.234,56` |
   | `documento` | texto livre (nota fiscal/fatura vinculada) | `NF-000456` |

   Qualquer outro formato de data ou valor faz a linha ser contada como
   erro (`total_erros` do lote) e ela **não** é importada — não há
   tentativa de adivinhar formatos alternativos, para não arriscar
   interpretar uma data errada silenciosamente.

2. No Supabase Studio: Table Editor → schema `pedagio` → tabela
   `staging_passagem_pedagio` → Insert → Import data from CSV. Confirme
   que os cabeçalhos do CSV batem com os nomes das colunas acima.

3. No SQL Editor, rode:

   ```sql
   select * from pedagio.processar_staging_passagens('nome_do_arquivo.csv', 'seu_nome');
   ```

   Isso, em uma única transação:
   - cria um `lote_importacao` para rastrear a carga;
   - tenta casar `placa` → `veiculo` e `praca_nome` → `praca_pedagio`
     (case-insensitive); quando não encontra, a linha é importada mesmo
     assim com `status_validacao = 'sem_cadastro'` (decisão do usuário —
     nada da planilha se perde, só fica marcado para revisão);
   - roda a validação geoespacial/tarifária (FASE 03) em todas as
     passagens recém-importadas;
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
where placa_informada = 'ABC1D23' and status_validacao = 'sem_cadastro';

select pedagio.processar_validacoes_pendentes();
```

## Posições de GPS (carga em lote)

Este documento cobre a importação de **passagens**. A carga em lote de
`posicao_veiculo` (antes da API existir) segue o mesmo padrão de staging,
mas ainda não tem uma tabela/função dedicada — avaliar se vale a pena
replicar esta mesma abordagem quando a necessidade aparecer.
