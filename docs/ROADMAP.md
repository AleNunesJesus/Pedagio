# ROADMAP — Projeto Pedagio

Mesma disciplina do projeto de tickets: uma FASE por vez, só avança com aval
explícito ("vamos iniciar a FASE 0X"), só commita quando pedido.

## Decisões em aberto que impactam fases futuras

Registradas aqui para não esquecer — cada uma será resolvida na fase que
depende dela:

- ~~Multi-tenant/multi-frota~~ — **resolvido em 2026-09-10: single-tenant.**
- Tamanho da janela de tolerância tempo/distância — decidir na FASE 03.
- Tratamento de placa/praça não reconhecida na importação — decidir na
  FASE 04.
- Revalidação automática quando GPS via API chega depois da passagem —
  decidir na FASE 03 ou 04.
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

**Status:** 🔴 Não iniciado

**Objetivo:** implementar `validar_passagem(passagem_id)` conforme
[docs/fluxo-validacao.md](fluxo-validacao.md), resolvendo antes: janela de
tolerância e política de revalidação.

**Checklist:**
- [ ] Decisão: janela de tempo (minutos) — fixa ou por praça
- [ ] Decisão: revalidação automática ao chegar GPS novo via API
- [ ] Função/RPC `validar_passagem`
- [ ] Job/trigger para rodar em lote sobre passagens `pendente`
- [ ] Script de verificação `.mjs` (caso ok, fora_poligono, sem_dados_gps, valor_divergente)

**Notas de implementação:** _(preenchido ao concluir a fase)_

---

## FASE 04 — Importação (planilha)

**Status:** 🔴 Não iniciado

**Objetivo:** pipeline de importação de `passagem_pedagio` (e, quando
aplicável, `posicao_veiculo`) a partir de arquivo, resolvendo antes:
tratamento de placa/praça não reconhecida.

**Checklist:**
- [ ] Decisão: bloquear linha vs. importar como `sem_cadastro`
- [ ] Rotina de parsing/normalização do arquivo
- [ ] Vínculo com `lote_importacao`
- [ ] Disparo da validação (FASE 03) após importar
- [ ] Script de verificação `.mjs`

**Notas de implementação:** _(preenchido ao concluir a fase)_

---

## FASE 05 — Indicadores

**Status:** 🔴 Não iniciado

**Objetivo:** views/materialized views para os indicadores listados em
[docs/indicadores.md](indicadores.md).

**Checklist:**
- [ ] Views financeiras
- [ ] Views de auditoria/validação
- [ ] Views operacionais
- [ ] Script de verificação `.mjs`

**Notas de implementação:** _(preenchido ao concluir a fase)_

---

## FASE 06 — Frontend/dashboard

**Status:** 🔴 Não iniciado — stack ainda não definida

---

## Estado atual

FASE 01 e FASE 02 concluídas (schema `pedagio` completo — cadastros +
tabelas de movimento — aplicado e verificado no Supabase, project_id
`wduypqixkafimcndytiz`). Decisão de multi-tenant resolvida: single-tenant.
Aguardando aval para iniciar a FASE 03.

## Próximo passo

FASE 03 — Função de validação geoespacial + tarifária, incluindo as
decisões de janela de tolerância e revalidação automática que ainda estão
em aberto.
