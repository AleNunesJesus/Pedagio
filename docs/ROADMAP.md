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
- ~~Stack de frontend/dashboard~~ — **resolvido em 2026-09-10: Next.js,
  auth compartilhado com o sistema de tickets, acesso liberado para
  qualquer autenticado.**
- ~~Biblioteca de mapa~~ — **resolvido em 2026-09-10/11: Leaflet + Leaflet.draw + OpenStreetMap.**
- ~~Validação geo/tarifária para linhas `tipo_uso = contrato`~~ — **resolvido
  em 2026-09-11: pulam a validação (`status_validacao = nao_aplicavel`).**
- ~~Viagem/embarcador~~ — **resolvido em 2026-09-11: campos texto simples,
  sem cadastro próprio por ora.**
- ~~Casamento de praça na importação~~ — **resolvido em 2026-09-11: por
  (nome, sentido) juntos, não só nome.**

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

**Status:** 🟡 Em andamento

Decisões fechadas (2026-09-10): stack **Next.js** (mesma do projeto de
tickets); autenticação **compartilhada** com o sistema de tickets (mesmo
Supabase Auth, mesmo `auth.users`); controle de acesso **qualquer usuário
autenticado vê/edita tudo** (sem papéis admin/operador por enquanto).

**FASE 06.1 — RLS + grants para acesso autenticado** — 🟢 Concluído
- [x] Policy `authenticated_full_access` (USING/CHECK true) nas 9 tabelas do schema `pedagio`
- [x] Grants (`usage`, `select/insert/update/delete`, `execute`) para `authenticated` + `alter default privileges` para tabelas/funções futuras
- [x] Verificado: `authenticated` enxerga dado de teste; `anon` recebe `permission denied` (schema `pedagio` nunca foi liberado pra `anon`)
- [x] **Pendência do usuário:** habilitar `pedagio` em Dashboard → Settings → API → Exposed schemas (não é possível via MCP)
- Migration: `20260910200708_pedagio_fase06_rls_acesso_autenticado`

**FASE 06.2 — Scaffold Next.js + login** — 🟢 Concluído
- [x] Criar app Next.js (App Router) em `Pedagio/app/`
- [x] Cliente Supabase (browser + server, mesma abordagem `@supabase/ssr` do projeto de tickets, com `db.schema: "pedagio"`)
- [x] Tela de login reaproveitando `auth.users` existente (sem cadastro novo, sem tabela de perfil própria)
- [x] Layout base (`(app)/layout.tsx` com guard `requireAutenticado`) + página `/dashboard` placeholder

**FASE 06.3 — Dashboard de indicadores** — 🟢 Concluído
- [x] Telas consumindo as 9 views da FASE 05 (financeiro, auditoria, operacional)

**Notas de implementação (06.3):**
- Seguida a skill `dataviz` do repositório de skills: paleta categórica/
  sequencial/status validada (`src/features/dashboard/colors.ts`), forma
  escolhida pelo trabalho do dado (tendência → linha/área, ranking →
  barra horizontal, proporção com semântica de estado → lista de barras
  com cor de status, >7 categorias/detalhe → tabela), tooltip com hover em
  todo gráfico, texto nunca na cor da série, gridlines recessivas.
- `vw_status_resumo` usa a **paleta de status** (good/warning/serious/
  critical), não a categórica — os valores de `status_validacao` são
  estados, não identidades de série; cor nunca aparece sem o rótulo em
  texto ao lado (regra "nunca só cor").
- `vw_volume_passagens_praca_dia` (praça × dia) foi agregado por dia
  (somando todas as praças) para virar um único gráfico de tendência —
  o grid completo praça×dia (heatmap) ficou de fora por ora; considerar
  se um drill-down por praça for necessário depois.
- Cores dos gráficos (recharts) usam os hexadecimais fixos do modo claro
  da paleta; a página já tem classes `dark:` nos contêineres (cards,
  texto), mas as cores das marcas dos gráficos ainda não trocam
  automaticamente no modo escuro — o app ainda não tem alternância de tema
  (isso não fazia parte do escopo desta fase). Ajustar se/quando um toggle
  de tema for adicionado.
- **Verificação:** populei dados de teste realistas (`[SEED]`/`SEED*`,
  2 meses, 2 praças, status variados) e confirmei via consulta direta
  (mesmas 9 views que a página usa) que os números batem com o esperado
  (totais, percentuais, taxas). Também confirmei — ponto importante — que
  o PostgREST serializa `numeric` como número JSON de verdade (não string),
  o que valida a soma feita em `reduce()` na página. Dados de teste
  removidos ao final (zero resíduo confirmado).
  **Limitação honesta:** não há ferramenta de navegador/screenshot neste
  ambiente, então os gráficos não foram conferidos visualmente (layout,
  colisão de rótulos, etc. — passo 7 da skill `dataviz`). Recomendo
  conferir em `http://localhost:3001/dashboard` com dados reais importados
  antes de considerar o visual definitivo.

**FASE 06.4 — Cadastros (praças, tarifas, veículos, categorias)** — 🟢 Concluído
- [x] Decisão: biblioteca de mapa — Leaflet + OpenStreetMap (sem chave de API)
- [x] Backend: view `vw_praca_pedagio_mapa` (poligono como GeoJSON) + funções `criar_praca`/`atualizar_praca` (GeoJSON → geometry, valida Polygon + `ST_IsValid`)
- [x] CRUD de categoria (form + lista)
- [x] CRUD de veículo (form + lista, categoria via select)
- [x] Cadastro de praça com mapa (`PolygonMapEditor`, Leaflet + Leaflet.draw puro, sem react-leaflet) — criar e editar, um polígono por vez
- [x] Cadastro de tarifa (form + lista), com tratamento de erro amigável para sobreposição de vigência (`23P01`)
- [x] Navegação: header com links Painel/Cadastros, abas dentro de Cadastros
- [x] **Bug encontrado e corrigido:** `service_role` nunca tinha recebido `GRANT` no schema `pedagio` (só `authenticated`, na FASE 06.1) — descoberto porque o script de verificação usava a service key para limpar dados de teste e as exclusões falhavam silenciosamente. Corrigido com grants + `alter default privileges` para `service_role`, igual já existia para `authenticated`.
- [x] Verificação via REST com usuário real: criar categoria/veículo, `criar_praca`/`atualizar_praca` via RPC com GeoJSON, leitura da view confirmando GeoJSON, criar tarifa, tarifa sobreposta rejeitada (`23P01`) — 10/10 checks, usuário e dados de teste removidos ao final
- [x] `typecheck`/`eslint`/`next build` limpos

**Notas de implementação (06.4):**
- Migrations aplicadas: `20260911000102_pedagio_fase06_4_praca_geojson`,
  `20260911001022_pedagio_fix_service_role_grants` (mirror local em
  `supabase/migrations/`).
- O PostgREST devolve `geometry` como WKB hex, não GeoJSON — por isso a
  view de leitura usa `ST_AsGeoJSON` e as escritas passam por RPC
  (`criar_praca`/`atualizar_praca`) que fazem `ST_GeomFromGeoJSON`. O
  frontend nunca lida com WKB diretamente.
- `PolygonMapEditor` usa Leaflet + Leaflet.draw **imperativamente** (não
  react-leaflet), para não depender de peer-deps de React desse
  ecossistema (react-leaflet-draw é pouco mantido); carregado via
  `next/dynamic({ ssr: false })` porque Leaflet toca `window` no import.
- `DataTable`/`Card`/`EmptyState` foram movidos de
  `features/dashboard/components/` para `components/ui/` — passaram a
  ser usados também pelos cadastros, deixou de fazer sentido morar
  dentro de uma feature específica.
- Formulários usam Server Actions + Zod (mesmo padrão do login), com
  mensagens de erro amigáveis para violações conhecidas (`23505` placa/
  código duplicado, `23P01` tarifa sobreposta).
- Edição só existe para praça (o mapa exige); categoria/veículo têm só
  criação + listagem por ora — editar/desativar pode ser adicionado
  depois se for necessário.

**FASE 06.5 — Importação (UI)** — 🟢 Concluído
- [x] Página `/importacao`: upload de CSV → grava em `staging_passagem_pedagio` → chama `processar_staging_passagens` → mostra total de linhas/erros do lote
- [x] Histórico de lotes importados (arquivo, usuário, linhas, erros, data)
- [x] Parsing de CSV robusto (`papaparse`, lida com campos entre aspas contendo vírgula) — mesmos cabeçalhos documentados em `docs/importacao.md`
- [x] Validação prévia: erro amigável se nenhuma coluna esperada for encontrada, ou se o arquivo passar de 5000 linhas
- [x] Verificação: parsing testado isoladamente (campo com vírgula interna, detecção de colunas); fluxo insert+RPC testado via REST com usuário real — 13/13 checks (JWT tem `email` na raiz dos claims, linha reconhecida, `sem_cadastro`, linha com erro de formato não inserida), zero resíduo
- [x] `docs/importacao.md` atualizado: upload pelo app é o caminho normal agora, Supabase Studio vira alternativa manual
- [x] `typecheck`/`eslint`/`next build` limpos

**Notas de implementação (06.5):**
- Server Actions não são invocáveis via HTTP simples (protocolo próprio do
  Next.js para RSC actions), então a verificação testou os dois pedaços
  separadamente: parsing do CSV isolado (offline) e a sequência real
  insert-staging + RPC via REST com um usuário autenticado de verdade —
  cobre a mesma lógica que a Server Action executa.
- `p_usuario` do lote vem de `supabase.auth.getClaims().data.claims.email`
  — confirmado que o JWT do Supabase Auth traz `email` na raiz dos claims
  (decodificado e conferido na verificação).
- Limite de 5000 linhas por importação (mensagem de erro, não trava
  silenciosamente) — ajustar se o volume real precisar de mais.

**FASE 06.6 — Passagens e validações (consulta/detalhe)** — 🟢 Concluído
- [x] Lista em `/passagens` com filtro por status/praça/veículo/período (form GET, sem JS) + paginação (50/página)
- [x] Detalhe em `/passagens/[id]`: status colorido, dados da passagem, resultado da validação (dentro do polígono, distância, diferença de tempo, valor esperado, divergência)
- [x] `STATUS`/`STATUS_VALIDACAO_INFO` movidos de `features/dashboard/colors.ts` para `lib/status-validacao.ts` (agora usado por dashboard e passagens)
- [x] Navegação: link "Passagens" no header
- [x] Verificação via REST com usuário real: 3 passagens de teste, filtro por status/veículo/período cada um retornando exatamente o esperado, detalhe com todos os campos da página — 9/9 checks, zero resíduo
- [x] `typecheck`/`eslint`/`next build` limpos

**Notas de implementação (06.6):**
- Filtros são um `<form method="get">` puro (sem client component) —
  atualiza a URL e a página server-renderiza de novo; paginação também é
  só links preservando os filtros atuais na querystring.
- Detalhe e lista reusam `vw_passagens_detalhado` (FASE 05) — já tinha
  todos os campos necessários, não precisou de view nova.
- **Esta fase fecha o plano atual do projeto** (FASE 01 a FASE 06.6 todas
  concluídas). Próximos passos ficam a critério do usuário — ex.:
  refinar UX, adicionar papéis (admin/operador), importação de GPS em
  lote, ou qualquer necessidade que surgir do uso real.

**Notas de implementação (06.1):**
- Optamos por RLS simples (`true`/`true`) em vez de papéis porque a decisão
  do usuário foi "qualquer autenticado vê/edita tudo" — se algum dia
  precisar de admin vs. operador, as políticas atuais precisam ser
  substituídas por checks reais (não é só adicionar, é trocar).
- `anon` nunca recebeu `GRANT USAGE ON SCHEMA pedagio` — por isso o erro é
  "permission denied" (nem chega a avaliar RLS), o que é o comportamento
  correto: só usuários logados devem tocar nesse schema.

**Notas de implementação (06.2):**
- Stack idêntica ao projeto de tickets: Next.js 16.3.3 (App Router,
  Turbopack), React 19.2.8, `@supabase/ssr` + `@supabase/supabase-js`,
  Tailwind 4, TypeScript estrito, ESLint flat config. App vive em
  `Pedagio/app/` (subpasta própria, para não misturar com `docs/` e
  `supabase/` na raiz do projeto).
- Next.js 16 renomeou `middleware.ts` para `proxy.ts` — replicado
  (`src/proxy.ts` + `src/lib/supabase/proxy.ts`) exatamente como no projeto
  de tickets.
- Clientes Supabase (`client.ts`/`server.ts`) usam
  `db: { schema: "pedagio" }` e o segundo generic `<Database, "pedagio">`
  — por padrão eles nunca tocam o `public` do sistema de tickets.
- Diferente do projeto de tickets, **não existe tabela de perfil** própria
  do Pedagio (`usuarios` equivalente): o guard `requireAutenticado` só
  confere se há uma sessão Supabase Auth válida (`auth.getClaims()`), sem
  checar papel/ativo — condizente com a decisão "qualquer autenticado vê/
  edita tudo".
- `src/types/database.ts` foi **escrito à mão** a partir das migrations
  reais (`generate_typescript_types` do MCP só cobre `public`, mesmo com
  `pedagio` exposto — confirmado por probe direto ao PostgREST). Colunas
  `geometry` (`poligono`, `geom`) estão tipadas como `string` (WKB hex) —
  decisão pendente para a FASE 06.4 sobre como servir/editar isso num mapa
  (provavelmente uma view com `ST_AsGeoJSON`).
- Verificação **real** de ponta a ponta (não só SQL): script Node
  descartável criou um usuário via Admin API, fez login por senha de
  verdade, e usou o `access_token` retornado para bater no PostgREST
  (`Accept-Profile: pedagio`) confirmando leitura de tabela e view,
  inserção e exclusão respeitando RLS, e que `anon` continua bloqueado —
  usuário de teste removido ao final. Também iniciei o `next dev` local
  momentaneamente para confirmar que `/` redireciona para `/login` (307,
  usuário não autenticado) e que `/login` renderiza o formulário.
- `npm run typecheck`, `npx eslint .` e `npx next build` rodaram limpos.
- `dev`/`start` fixados na porta **3001** (`next dev -p 3001` /
  `next start -p 3001`) para poder rodar junto com o projeto de tickets
  (porta 3000) — pedido do usuário em 2026-09-10.
- `app/AGENTS.md` e `app/CLAUDE.md` são gerados automaticamente pelo
  próprio `next dev`/`next build` do Next.js 16 (aviso sobre breaking
  changes desta versão para agentes de IA) — não foram criados por mim,
  são normais e podem ser commitados.

---

## FASE 07 — Ajuste ao formato real da planilha do fornecedor

**Status:** 🟢 Concluído

**Objetivo:** adequar staging/`passagem_pedagio`/views/frontend ao layout
exato da planilha real disponibilizada pelo usuário: fatura, data e
horário separados, tipo de veículo informado, tipo de uso (passagem/
contrato), condição (débito/crédito, valor já assinado), viagem,
embarcador e sentido.

**Checklist:**
- [x] Decisão: `tipo_uso = contrato` pula a validação geo/tarifária (novo status `nao_aplicavel`)
- [x] Decisão: viagem/embarcador como campos texto simples (sem cadastro próprio)
- [x] Decisão: casamento de praça na importação por (nome, sentido) juntos
- [x] `staging_passagem_pedagio`: colunas remodeladas para o layout real (`numero_fatura`, `data_texto`, `horario_texto`, `tipo_veiculo`, `tipo_uso_texto`, `condicao_texto`, `viagem`, `embarcador`, `sentido`)
- [x] `passagem_pedagio`: `id_externo`→`numero_fatura`, `documento_vinculado` removido, colunas novas (`tipo_veiculo_informado`, `sentido_informado`, `tipo_uso`, `condicao`, `viagem`, `embarcador`), check de `valor_cobrado` trocado (sinal deve bater com `condicao`, crédito pode ser negativo), novo status `nao_aplicavel`
- [x] Helpers novos: `parse_data_hora_planilha` (data+hora separados, aceita `HH24:MI:SS` ou `HH24:MI`), `normalizar_tipo_uso`, `normalizar_condicao` (case/acento-insensitive); `parse_data_hora_br` removido (sem uso)
- [x] `processar_staging_passagens` reescrita: monta `data_hora`, normaliza `tipo_uso`/`condicao`, casa praça por (nome, sentido), grava `nao_aplicavel` direto para `contrato` (nunca `pendente`)
- [x] Views: `vw_passagens_detalhado` ganha as colunas novas (compatível com as views dependentes, sem quebrar nada); `vw_praca_taxa_fora_poligono`/`vw_veiculo_taxa_divergencia` excluem `nao_aplicavel` do denominador; `vw_volume_passagens_praca_dia` conta só `tipo_uso = passagem`
- [x] `get_advisors` — sem achados novos
- [x] Verificação via SQL direto (`execute_sql`): 5 linhas de staging cobrindo passagem/débito casada, contrato/crédito (valor negativo, viagem/embarcador preservados), praça com sentido divergente (`sem_cadastro`), data inválida e `tipo_uso` inválido (ambas viram erro) — 1 lote com `total_linhas=5`/`total_erros=2`, tudo conferido, cleanup confirmado
- [x] Verificação via REST com usuário real (mesmo caminho da Server Action): 13/13 checks (cadastros de apoio, staging + RPC, view com campos novos, linha inválida não importada), zero resíduo
- [x] Frontend: `types/database.ts`, `lib/status-validacao.ts` (label para `nao_aplicavel`), módulo de importação (colunas esperadas + texto de ajuda), listagem/detalhe de passagens (filtro por tipo de uso, colunas/campos novos)
- [x] `docs/importacao.md` e `docs/modelo-dados.md` atualizados para o novo layout
- [x] `typecheck`/`eslint`/`next build` limpos

**Notas de implementação:**
- Migration aplicada: `20260911115052_pedagio_fase07_formato_planilha_real`
  (mirror local em `supabase/migrations/`). Tabelas de movimento estavam
  vazias no momento da migration (confirmado antes de aplicar) — todas as
  alterações foram `ALTER TABLE`/`DROP`/`ADD COLUMN` diretas, sem
  necessidade de backfill.
- "Tipo de veículo" da planilha é só informativo
  (`tipo_veiculo_informado`) — a tarifa continua usando a categoria já
  cadastrada do veículo (`veiculo.categoria_veiculo_id`), não este campo
  solto da planilha.
- Linha com sinal de valor inconsistente com a condição informada (débito
  negativo, crédito positivo) é tratada como erro de importação (não
  insere, conta em `total_erros`) — evita depender só do `check` da
  tabela para barrar dado ruim.
- `horario_texto` aceita `HH24:MI:SS` ou `HH24:MI` (dois formatos fixos,
  não um "adivinhador" genérico) — planilhas reais costumam vir sem
  segundos.
- Views financeiras (`vw_financeiro_mensal` etc.) continuam somando tudo,
  incluindo `contrato`: débito soma, crédito já vem negativo e abate,
  refletindo o gasto líquido real. Só as views de auditoria/volume de
  passagens (que medem acurácia de validação/contagem de passagens
  físicas) excluem `contrato`/`nao_aplicavel`.

---

## FASE 08 — Papéis de acesso (admin/operador)

**Status:** 🟢 Concluído

**Objetivo:** substituir as policies `authenticated_full_access` (true/true)
por controle de acesso real com dois papéis: **admin** (acesso total) e
**operador** (consulta + importação, sem CRUD de cadastros/tarifas).

**Decisões fechadas (2026-09-11):**
- Papéis: **admin** edita tudo (cadastros, tarifas, veículos, categorias,
  praças, importação, consulta). **Operador** só consulta (dashboard,
  passagens, cadastros em modo leitura) e usa a importação de planilha —
  não cria/edita/exclui categoria, praça, tarifa ou veículo.
- Armazenamento: tabela `pedagio.usuario_perfil` (`user_id` FK
  `auth.users`, `papel` check `admin`/`operador`) + tela de gestão de
  usuários (só admin acessa) para listar usuários e definir/trocar papel —
  sem depender de SQL manual no dia a dia.
- Papel padrão: usuário autenticado **sem registro** em `usuario_perfil` é
  **bloqueado** (nem operador) até um admin definir o papel dele.
- Bootstrap do primeiro admin: `INSERT` manual via SQL/Studio logo após a
  migration (não existe admin ainda para usar a tela) — comando será
  fornecido nesta fase.

**Checklist:**
- [x] Tabela `pedagio.usuario_perfil` (`user_id uuid PK/FK auth.users(id)`,
  `papel text check in ('admin','operador')`, timestamps) + RLS própria
  (só admin lê/escreve a tabela diretamente)
- [x] Função helper `pedagio.eh_admin()` (SECURITY DEFINER, STABLE,
  `search_path = ''`) — checa se `auth.uid()` tem `papel = 'admin'`
- [x] Função helper `pedagio.usuario_autorizado()` — checa se `auth.uid()`
  tem QUALQUER registro em `usuario_perfil` (admin ou operador); usada nas
  policies de leitura em vez de só `authenticated`
- [x] Função `pedagio.meu_papel()` (SECURITY DEFINER) — retorna o papel do
  usuário logado, para o frontend decidir o que mostrar/esconder
- [x] Funções admin-only `pedagio.listar_usuarios()` (join `auth.users` +
  `usuario_perfil`), `pedagio.definir_papel(usuario_id, papel)` e
  `pedagio.remover_papel(usuario_id)` — todas verificam `eh_admin()`
  internamente e lançam exceção se não for admin
- [x] Policies revisadas nas 9 tabelas do schema `pedagio`:
  - Cadastros (`categoria_veiculo`, `praca_pedagio`, `tarifa_praca`,
    `veiculo`): SELECT para `usuario_autorizado()`, INSERT/UPDATE/DELETE
    só para `eh_admin()`
  - `staging_passagem_pedagio`: ALL para `usuario_autorizado()` (tabela
    100% operacional, sem dado sensível de cadastro)
  - `lote_importacao`/`passagem_pedagio`/`validacao_passagem`: SELECT/
    INSERT/UPDATE para `usuario_autorizado()` (o motor de validação é
    SECURITY INVOKER e roda como quem importou); DELETE só `eh_admin()`
  - `posicao_veiculo`: SELECT para `usuario_autorizado()`; INSERT/UPDATE/
    DELETE restrito a `eh_admin()` por ora (sem UI de carga de GPS ainda —
    revisar quando essa importação existir)
- [x] Migration aplicada + mirror local em `supabase/migrations/`
- [x] Frontend: tela `/usuarios` (guard `requireAdmin`) listando usuários +
  select de papel + ação salvar (RPCs `definir_papel`/`remover_papel`);
  link "Usuários" no header só para admin; forms de criar/editar
  escondidos para operador em categorias/veículos/tarifas/praças; rotas
  `/cadastros/pracas/nova` e `/cadastros/pracas/[id]` redirecionam
  operador de volta à listagem; página `/sem-acesso` (fora do grupo
  `(app)`, para não entrar em loop de redirect) para autenticado sem papel
- [x] `get_advisors` — únicos achados são o WARN padrão "SECURITY DEFINER
  executável por authenticated/anon" nas 6 funções novas (esperado: são
  helpers que retornam false/null para quem não tem papel, e RPCs
  admin-only que se autoverificam com `eh_admin()` e lançam exceção —
  mesmo padrão já usado em `atualizar_perfil_proprio` no projeto de
  tickets) + o WARN pré-existente de leaked password protection
- [x] Verificação via REST com 3 usuários reais (admin, operador, sem
  papel): `meu_papel()` correto para os 3, SELECT em cadastro liberado
  para admin/operador e bloqueado para sem-papel, INSERT em cadastro só
  admin, fluxo completo de importação (staging→RPC→validação) funcionando
  para operador, `listar_usuarios`/`definir_papel` só admin, promoção e
  remoção de papel refletindo imediatamente em `meu_papel()` — 18/18
  checks, zero resíduo (usuários e dados de teste removidos ao final)
- [x] `typecheck`/`eslint`/`next build` limpos

**Notas de implementação:**
- Migration aplicada: `20260911122829_pedagio_fase08_papeis_acesso`
  (mirror local em `supabase/migrations/`).
- Bootstrap do primeiro admin feito via `INSERT` direto (service role) em
  `pedagio.usuario_perfil` para `alexandre.nunes@dinon.com.br` — a partir
  daqui, qualquer promoção/remoção de papel passa pela tela `/usuarios`.
- Todos os helpers/RPCs são `SECURITY DEFINER` com `search_path = ''`,
  seguindo o padrão já usado nas funções de validação (FASE 03) — o
  `get_advisors` sinaliza isso como WARN por padrão (qualquer função
  SECURITY DEFINER exposta), mas é intencional: `eh_admin`/
  `usuario_autorizado`/`meu_papel` são seguros para qualquer chamador
  (retornam `false`/`null` sem papel), e as RPCs de gestão fazem a própria
  verificação de admin internamente.
- `staging_passagem_pedagio` ficou com policy única `ALL` para qualquer
  autorizado (sem distinção admin/operador) porque é uma tabela puramente
  operacional/transitória — não há cadastro para proteger ali, e o
  operador precisa de INSERT+SELECT+DELETE nela para o fluxo de
  importação funcionar de ponta a ponta.
- `passagem_pedagio`/`validacao_passagem`/`lote_importacao` precisaram
  liberar UPDATE (não só INSERT) para `usuario_autorizado()` porque
  `processar_staging_passagens`/`validar_passagem` são `SECURITY INVOKER`
  (decisão da FASE 03) — rodam com o papel de quem importou, então o
  operador precisa desses direitos para o próprio pipeline de validação
  concluir (ex.: `UPDATE passagem_pedagio SET status_validacao = ...`).
- Nenhuma tela nova precisou de checagem de papel *dentro* da server
  action — a UI esconde os controles que operador não deveria ver, e a
  RLS é a linha de defesa real (uma tentativa direta de bypass da UI
  recebe erro de permissão do Postgres, não um bug silencioso).
- Página `/sem-acesso` fica **fora** do grupo de rotas `(app)` de
  propósito: o layout de `(app)` já redireciona para `/sem-acesso` quem
  não tem papel, então colocar essa página dentro do mesmo grupo causaria
  loop de redirecionamento.

---

## Estado atual

**Projeto completo (FASE 01 a FASE 08) até o plano atual.** Schema
`pedagio` (cadastros, movimento, validação com revalidação automática,
importação no layout real do fornecedor, indicadores, papéis de acesso
admin/operador) + app Next.js (login compartilhado, dashboard, cadastros
com mapa, importação via UI, consulta de passagens/validações, gestão de
usuários) — tudo aplicado e verificado no Supabase
(`wduypqixkafimcndytiz`).

## Próximo passo

Nenhum item pendente do plano atual. Próximos passos dependem do uso
real do sistema — ver "Decisões em aberto" abaixo para itens que ficaram
conscientemente de fora (carga de GPS em lote, cadastro próprio de
viagem/embarcador, etc.).
