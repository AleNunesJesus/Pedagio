# ROADMAP — Projeto Pedagio

Mesma disciplina do projeto de tickets: uma FASE por vez, só avança com aval
explícito ("vamos iniciar a FASE 0X"), só commita quando pedido.

## Decisões em aberto que impactam fases futuras

Registradas aqui para não esquecer — cada uma será resolvida na fase que
depende dela:

- ~~Multi-tenant/multi-frota~~ — **resolvido em 2026-09-10: single-tenant.**
- ~~Janela de tolerância tempo/distância~~ — **resolvido em 2026-09-10: fixa
  em ±10 minutos.**
- ~~Revalidação automática ao chegar GPS depois~~ — **resolvido em
  2026-09-10: sim, via trigger.**
- ~~Tratamento de placa/praça não reconhecida na importação~~ —
  **resolvido em 2026-09-10: importa como `sem_cadastro`, não bloqueia.**
- Carga em lote de `posicao_veiculo` (GPS) — ainda sem staging/função
  dedicada; avaliar quando a necessidade aparecer.
- Stack de frontend/dashboard — decidir antes da FASE 06.

---

## FASE 01 — Schema base e cadastros

**Status:** 🟢 Concluído

**Objetivo:** criar o schema `pedagio`, habilitar PostGIS, e as tabelas de
cadastro que não dependem de volume/tempo real: `categoria_veiculo`,
`praca_pedagio`, `tarifa_praca`, `veiculo`.

**Checklist:**
- [x] `CREATE SCHEMA pedagio`
- [x] Confirmar/habilitar extensão PostGIS (e `btree_gist`, para a exclusion constraint)
- [x] Tabela `categoria_veiculo`
- [x] Tabela `praca_pedagio` (com `poligono geometry(Polygon, 4326)`, índice GIST)
- [x] Tabela `tarifa_praca` (com `EXCLUDE USING gist` contra sobreposição de vigência)
- [x] Tabela `veiculo`
- [x] RLS habilitada nas 4 tabelas (sem políticas ainda — a definir conforme decisão multi-tenant na FASE 02)
- [ ] `generate_typescript_types` — adiado: ainda não há frontend/cliente consumindo essas tabelas
- [x] `get_advisors` (segurança + performance) — sem novos alertas inesperados
- [x] Verificação via SQL direto (`execute_sql`): inserts positivos, sobreposição de vigência rejeitada (`exclusion_violation`), `vigencia_fim < vigencia_inicio` rejeitada (`check_violation`), `ST_Contains` reconhece ponto dentro/fora do polígono, cleanup confirmado (contagens zeradas)

**Notas de implementação:**
- Migrations aplicadas: `20260910181949_pedagio_fase01_schema_cadastros` e
  `20260910182016_pedagio_fase01_fk_indexes` (mirror local em
  `supabase/migrations/`).
- PostGIS e `btree_gist` instalados no schema `extensions` (convenção já
  usada pelo projeto de tickets no mesmo banco: `pgcrypto`, `uuid-ossp`,
  `pg_stat_statements` também estão em `extensions`).
- Advisor de performance apontou 2 FKs sem índice
  (`tarifa_praca.categoria_veiculo_id`, `veiculo.categoria_veiculo_id`) —
  corrigido na segunda migration da fase.
- Sem script `.mjs` local desta vez: o projeto Pedagio ainda não tem
  `.env`/cliente Node configurado, e como nenhuma política de RLS foi
  criada ainda (decisão adiada), não há papéis de usuário para simular —
  a verificação via `execute_sql` direto cobre igualmente positivo/negativo
  com o banco real, conforme alternativa já prevista no padrão de
  verificação do projeto de tickets.
- Não há repositório git nesta pasta ainda (`Is a git repository: false`) —
  nenhum commit foi feito; perguntar ao usuário se deseja inicializar git
  aqui antes de seguir.

**Verificações adiadas para fases seguintes:** definição de RLS/multi-tenant
(FASE 02), `generate_typescript_types` quando o frontend existir (FASE 06).

---

## FASE 02 — Tabelas de movimento

**Status:** 🟢 Concluído

**Objetivo:** tabelas de alto volume e a tabela de staging: `lote_importacao`,
`posicao_veiculo`, `passagem_pedagio`, `validacao_passagem`.

**Checklist:**
- [x] Tabela `lote_importacao`
- [x] Tabela `posicao_veiculo` (índices GIST(geom) e (veiculo_id, data_hora); particionamento por mês adiado — sem volume ainda)
- [x] Tabela `passagem_pedagio`
- [x] Tabela `validacao_passagem`
- [x] RLS nas 4 tabelas (sem políticas ainda — confirmado single-tenant; controle de acesso por papel fica para a FASE 06)
- [x] Verificação via SQL direto (`execute_sql`): inserts positivos (lote → posição → passagem → validação encadeados), `status_validacao` fora do domínio rejeitado (`check_violation`), segunda validação para a mesma passagem rejeitada (`unique_violation` — confirma 1:1), validação com `passagem_id` inexistente rejeitada (`foreign_key_violation`), cleanup confirmado (contagens zeradas)

**Notas de implementação:**
- Migration aplicada: `20260910182708_pedagio_fase02_tabelas_movimento`
  (mirror local em `supabase/migrations/`).
- Decisão de multi-tenant resolvida (2026-09-10): **single-tenant**. Não há
  coluna de empresa/frota em `veiculo` nem filtro por tenant nas policies —
  qualquer usuário autenticado do sistema enxerga todos os dados; a
  diferenciação de acesso (ex.: admin vs. operador) é uma decisão de
  papéis/frontend, adiada para a FASE 06.
- `status_validacao` (em `passagem_pedagio`) e `resultado` (em
  `validacao_passagem`) já incluem `sem_cadastro`/todos os valores do fluxo
  de validação no `check` constraint, para não exigir migration extra nas
  próximas fases.
- Particionamento de `posicao_veiculo` por mês (mencionado no desenho)
  adiado para quando o volume real justificar — tabela criada como regular
  por enquanto.
- `get_advisors` sem achados novos além do esperado (RLS sem política nas 8
  tabelas do schema `pedagio`, índices "unused" por ainda não terem dados
  reais, WARNs pré-existentes do projeto de tickets).
- Repositório git inicializado nesta sessão em `Pedagio/` (ainda sem
  commits — aguardando o usuário pedir).

---

## FASE 03 — Função de validação (geoespacial + tarifária)

**Status:** 🟢 Concluído

**Objetivo:** implementar `validar_passagem(passagem_id)` conforme
[docs/fluxo-validacao.md](fluxo-validacao.md), resolvendo antes: janela de
tolerância e política de revalidação.

**Checklist:**
- [x] Decisão: janela de tempo — fixa em ±10 minutos (`pedagio.janela_tolerancia_validacao()`)
- [x] Decisão: revalidação automática ao chegar GPS novo (trigger em `posicao_veiculo`)
- [x] Função `pedagio.validar_passagem(passagem_id)`
- [x] Função `pedagio.processar_validacoes_pendentes()` (lote, para rodar após importação ou via job)
- [x] Trigger `posicao_veiculo_revalidar_passagens` (revalida `pendente`/`sem_dados_gps` do mesmo veículo ao chegar novo ping na janela)
- [x] `get_advisors` — WARN de `search_path` mutável nas 4 funções corrigido (`set search_path = ''`)
- [x] Verificação via SQL direto (`execute_sql`): casos `ok`, `fora_poligono`, `valor_divergente`, `sem_cadastro`, `sem_dados_gps` → revalidação automática para `ok` ao chegar ping tardio, e `processar_validacoes_pendentes` processando passagem pendente; cleanup confirmado (contagens zeradas)

**Notas de implementação:**
- Migrations aplicadas: `20260910185409_pedagio_fase03_funcao_validacao`,
  `20260910185427_pedagio_fase03_fix_search_path` (mirror local em
  `supabase/migrations/`).
- Janela de tolerância isolada em `pedagio.janela_tolerancia_validacao()`
  (retorna `interval`) para não duplicar o valor entre `validar_passagem` e
  o trigger — se um dia precisar variar por praça, essa é a única função a
  alterar.
- Caso não exista tarifa vigente cadastrada para a combinação
  praça+categoria+data, `divergencia_valor` fica `null` e o resultado passa
  a depender só da geo (não bloqueia nem marca como divergente) — decisão
  de simplificação, não estava no desenho original; revisar se fizer
  sentido criar um status específico para "sem tarifa cadastrada".
- Comparação de valor é exata (`=`), sem tolerância de centavos — o desenho
  original cogitava tolerância, mas ficou exata por simplicidade; ajustar
  se aparecerem divergências de arredondamento na prática.
- Funções `SECURITY INVOKER` (padrão), sem exposição via API ainda — RLS
  do schema `pedagio` continua sem políticas.
- Trigger dispara por linha (`FOR EACH ROW`); para cargas em lote muito
  grandes de `posicao_veiculo` isso significa uma verificação por linha
  inserida — aceitável no volume atual, mas revisar se performance for
  problema quando o volume crescer (FASE 04 já vai trazer volume real).

---

## FASE 04 — Importação (planilha)

**Status:** 🟢 Concluído

**Objetivo:** pipeline de importação de `passagem_pedagio` a partir de
arquivo, resolvendo antes: tratamento de placa/praça não reconhecida e
mecanismo de carga (sem tela de upload ainda).

**Checklist:**
- [x] Decisão: importar mesmo assim como `sem_cadastro` (não bloquear a linha)
- [x] Decisão: mecanismo de carga — staging table + import CSV nativo do Supabase Studio
- [x] Tabela `pedagio.staging_passagem_pedagio` (colunas cruas em texto)
- [x] Helpers de parsing `pedagio.parse_data_hora_br` e `pedagio.parse_valor_brl` (formato fixo, documentado — sem tentativa de adivinhar formato)
- [x] Função `pedagio.processar_staging_passagens` — casa placa/praça, insere em `passagem_pedagio`, cria `lote_importacao`, dispara validação (FASE 03), limpa a staging
- [x] `get_advisors` — sem achados novos além do esperado
- [x] Verificação via SQL direto (`execute_sql`): parsers isolados (milhar+decimal BR, data DD/MM/YYYY), linha com cadastro reconhecido → validada, linha sem cadastro → `sem_cadastro`, linhas com data/valor inválidos → viram erro e não são inseridas, contadores `total_linhas`/`total_erros` corretos, staging limpa ao final; cleanup confirmado (contagens zeradas)
- [x] Documentação do processo: [docs/importacao.md](importacao.md)

**Notas de implementação:**
- Migration aplicada: `20260910190043_pedagio_fase04_importacao` (mirror
  local em `supabase/migrations/`).
- Formato de data/hora e valor são **fixos e documentados**
  (`DD/MM/YYYY HH24:MI:SS`, número BR com vírgula decimal) — deliberadamente
  sem múltiplas tentativas de parsing automático, para não arriscar
  interpretar uma data/valor errado silenciosamente em dados financeiros.
  Qualquer linha fora desse formato vira erro contado em
  `lote_importacao.total_erros` e não é inserida.
- `processar_staging_passagens` processa TUDO que estiver na staging no
  momento da chamada (não há filtro por usuário/sessão) — adequado ao uso
  single-tenant/single-usuário atual; se um dia houver múltiplos
  importadores simultâneos, isso precisa ser revisitado.
- Carga em lote de `posicao_veiculo` (GPS) ainda não tem staging/função
  dedicada — só a carga de `passagem_pedagio` foi implementada nesta fase.
  Fica registrado como pendência para quando a necessidade aparecer.

---

## FASE 05 — Indicadores

**Status:** 🟢 Concluído

**Objetivo:** views/materialized views para os indicadores listados em
[docs/indicadores.md](indicadores.md).

**Checklist:**
- [x] View base `vw_passagens_detalhado` (join passagem + validação + praça + veículo)
- [x] Views financeiras: `vw_financeiro_mensal`, `vw_gasto_por_veiculo_mensal`, `vw_gasto_por_praca`
- [x] Views de auditoria/validação: `vw_status_resumo`, `vw_praca_taxa_fora_poligono`, `vw_veiculo_taxa_divergencia`, `vw_sem_dados_gps_por_dia`
- [x] Views operacionais: `vw_diferenca_tempo_media_por_praca`, `vw_volume_passagens_praca_dia`
- [x] `get_advisors` — sem achados novos além do esperado
- [x] Verificação via SQL direto (`execute_sql`): 5 passagens de teste cobrindo `ok`/`valor_divergente`/`fora_poligono`/`sem_dados_gps`/`sem_cadastro`, 2 praças, 2 veículos, 3 meses distintos; 12 asserções conferindo totais/percentuais/médias de cada view batendo com o esperado; cleanup confirmado (contagens zeradas)

**Notas de implementação:**
- Migration aplicada: `20260910191911_pedagio_fase05_indicadores` (mirror
  local em `supabase/migrations/`).
- Todas as views usam `with (security_invoker = true)` — importante
  porque, sem essa opção, uma view no Postgres roda com os privilégios do
  dono dela e ignoraria a RLS das tabelas de base; com ela, quando
  políticas de RLS forem adicionadas (FASE 06), as views passam a
  respeitá-las automaticamente sem precisar recriar nada.
- Views são simples (não materializadas) — volume atual não justifica
  materialização/refresh; reavaliar se o volume real (FASE de produção)
  tornar as agregações lentas.
- O indicador "mapa com polígonos + pings sobrepostos" do desenho original
  não vira view — é puramente uma renderização de frontend (FASE 06),
  consumindo `praca_pedagio.poligono` e `posicao_veiculo.geom` diretamente.

---

## FASE 06 — Frontend/dashboard

**Status:** 🔴 Não iniciado — stack ainda não definida

---

## Estado atual

FASE 01 a FASE 05 concluídas (schema `pedagio` completo — cadastros,
tabelas de movimento, função de validação com revalidação automática,
pipeline de importação e views de indicadores — aplicado e verificado no
Supabase, project_id `wduypqixkafimcndytiz`). Aguardando aval para iniciar
a FASE 06.

## Próximo passo

FASE 06 — Frontend/dashboard: falta decidir a stack.
