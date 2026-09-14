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
- ~~Carga em lote de `posicao_veiculo` (GPS)~~ — **resolvido em
  2026-09-11: staging + função dedicada, FASE 09.**
- ~~Stack de frontend/dashboard~~ — **resolvido em 2026-09-10: Next.js,
  auth compartilhado com o sistema de tickets, acesso liberado para
  qualquer autenticado.**
- ~~Biblioteca de mapa~~ — **resolvido em 2026-09-10/11: Leaflet + Leaflet.draw + OpenStreetMap.**
- ~~Validação geo/tarifária para linhas `tipo_uso = contrato`~~ — **resolvido
  em 2026-09-11: pulam a validação (`status_validacao = nao_aplicavel`).**
- ~~Viagem/embarcador~~ — resolvido em 2026-09-11 (campos texto simples,
  FASE 07); **revisto em 2026-09-11: cadastro próprio com FK e
  auto-cadastro na importação, FASE 10.**
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
- [x] `generate_typescript_types` — adiado: ainda não há frontend/cliente consumindo essas tabelas
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
- Migration aplicada: `20260911122825_pedagio_fase08_papeis_acesso`
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

## FASE 09 — Carga em lote de posições de GPS

**Status:** 🟢 Concluído

**Objetivo:** staging + função dedicada para importar `posicao_veiculo`
em lote, mesmo padrão da importação de passagens (FASE 04/07), para
alimentar o motor de validação (FASE 03) com pings de GPS reais.

**Decisões fechadas (2026-09-11):**
- Quem importa: **admin e operador** (mesmo papel da importação de
  passagens — FASE 08).
- Placa não cadastrada: linha pulada, conta como erro do lote (a tabela
  exige `veiculo_id`, não existe um status "sem cadastro" como em
  `passagem_pedagio`).
- Duplicidade: **bloqueada** — `unique (veiculo_id, data_hora)` em
  `posicao_veiculo`; reenviar o mesmo arquivo conta as linhas repetidas
  como erro, sem duplicar o ping.
- Formato do arquivo confirmado com o usuário: colunas `placa`,
  `latitude`, `longitude` (graus decimais), `data` (`DD/MM/YYYY`),
  `horario` (`HH24:MI:SS`). Integração direta com o provedor de
  rastreamento (API) fica para depois — por ora só carga via CSV.

**Checklist:**
- [x] `unique (veiculo_id, data_hora)` em `posicao_veiculo`
- [x] Tabela `pedagio.staging_posicao_veiculo` (colunas cruas em texto)
- [x] Helper `pedagio.parse_coordenada` (reaproveita `parse_data_hora_planilha`
  já existente para data/hora)
- [x] Função `pedagio.processar_staging_posicoes` — casa placa → veiculo,
  valida faixa de lat/lon, insere em `posicao_veiculo` com
  `fonte = 'carga_arquivo'`, ignora duplicados (`on conflict do nothing`),
  limpa a staging; a revalidação automática das passagens acontece via
  trigger já existente da FASE 03 (sem chamada explícita necessária)
- [x] RLS: `staging_posicao_veiculo` liberada a qualquer autorizado;
  `posicao_veiculo` passou a aceitar INSERT de autorizado (antes só admin)
- [x] Frontend: seção "Nova importação de posições de GPS" em
  `/importacao`, reaproveitando o padrão do form de passagens; histórico
  de lotes (`LoteList`) ganhou coluna "Tipo" pra diferenciar
  Passagens/GPS
- [x] `get_advisors` — sem achados novos além do padrão já esperado
- [x] Verificação via REST com usuário operador real: fluxo feliz
  (ping dentro do polígono e da janela → passagem revalidada
  automaticamente para `ok`, com `dentro_poligono=true`), duplicado
  (conta como erro, não duplica), placa não cadastrada + coordenada
  inválida (erro), usuário sem papel bloqueado — 7/7 checks, zero resíduo
- [x] `typecheck`/`eslint`/`next build` limpos
- [x] `docs/importacao.md` atualizado com a seção de GPS

**Notas de implementação:**
- Migrations aplicadas: `20260911171359_pedagio_fase09_importacao_gps` e
  `20260911171616_pedagio_fix_tipo_lote_posicoes_gps` (mirror local em
  `supabase/migrations/`).
- `lote_importacao.tipo` já tinha um `check` desde a FASE 02 restringindo
  a `'passagens'`/`'posicoes_gps'` — a primeira versão da função usava
  `'posicoes'` por engano; corrigido na segunda migration.
- `parse_coordenada` é só um cast numérico com trim/try-catch — não há
  formato BR (vírgula) aqui, coordenadas de GPS vêm sempre em ponto
  decimal simples.
- Ao contrário de `passagem_pedagio`, `posicao_veiculo.veiculo_id` é
  `NOT NULL` — não existe conceito de "sem_cadastro" pra ping de GPS, uma
  placa não reconhecida simplesmente não pode ser armazenada.
- `processar_staging_posicoes` é `SECURITY INVOKER` (mesmo padrão das
  outras funções de importação/validação) — o trigger de revalidação
  (`trg_revalidar_passagens_por_posicao`, também invoker) roda como quem
  importou, por isso a policy de INSERT em `posicao_veiculo` precisou
  virar `usuario_autorizado()` em vez de `eh_admin()`.
- Verificação inicial teve uma discrepância de horário entre o script de
  teste e `parse_data_hora_planilha` (que interpretava o texto do CSV
  como UTC direto). Na hora resolvi ajustando só o teste para o mesmo
  referencial — **isso era o sintoma de um bug real no produto**, só
  identificado de fato depois de um teste manual do usuário (ver "Ajuste
  pós-FASE 04/09 — fuso horário na importação", mais abaixo).

---

## Ajuste pós-FASE 07 — códigos reais do fornecedor (2026-09-11)

Primeiro arquivo real de teste (`teste_pedagio.csv`, 16 linhas) importou
**0 de 16** linhas (todas em erro). Investigação encontrou duas
divergências entre o que a FASE 07 assumiu e o layout real:

- `condicao_texto` vem como `DB`/`CR` (abreviado), não `debito`/`credito`
  por extenso — confirmado com o usuário que é **sempre** assim nos
  arquivos reais desse fornecedor.
- `tipo_uso_texto` de contrato vem como `PLANO CONTRATADO`, não
  `CONTRATO` — confirmado que é sempre esse o rótulo usado.
- Adicionalmente, linhas de crédito (`CR`) apareceram com **valor
  positivo** no arquivo (ex.: uma linha de débito 6,50 seguida de uma
  linha de crédito 23,00 na mesma passagem/viagem) — quebrando a regra
  da FASE 07 de "sinal deve bater com a condição, senão é erro".
  Confirmado com o usuário: crédito sempre reduz o gasto, então o sinal
  agora é **normalizado** pela condição em vez de barrar a linha.

**O que mudou** (migrations `pedagio_fix_normalizacao_condicao_tipo_uso_codigos_reais`
e `pedagio_fix_normalizacao_sinal_valor_credito`):
- `normalizar_condicao` aceita `DB`→débito e `CR`→crédito, além das
  palavras completas.
- `normalizar_tipo_uso` aceita `PLANO CONTRATADO`→contrato, além de
  `CONTRATO`.
- `processar_staging_passagens` deixou de rejeitar sinal inconsistente
  como erro — agora sempre grava débito como positivo e crédito como
  negativo (`abs`/`-abs` pela condição já normalizada), independente do
  sinal que veio no arquivo.
- `docs/importacao.md` atualizado com os novos valores aceitos e a nova
  regra de sinal.

**Verificação:** as 16 linhas reais do arquivo de teste reprocessadas
diretamente no banco (staging → RPC) — 16/16 sem erro, sinais corretos
(crédito sempre negativo), `tipo_uso = contrato` corretamente marcado
`nao_aplicavel`. Todas ficaram `sem_cadastro` (esperado: placas e a
praça "PRACA FRANCO DA ROCHA - SUL" ainda não estão cadastradas — não é
bug, falta cadastro). Dados de teste e lotes de tentativas anteriores
removidos, zero resíduo confirmado.

**Pendência aberta:** se aparecerem outros códigos/rótulos não mapeados
em arquivos futuros (ex.: variações de `tipo_veiculo` ou novos valores
de `condicao_texto`/`tipo_uso_texto`), o comportamento continua sendo
**erro explícito**, não adivinhação — trazer o caso real para mapear,
como fizemos aqui.

---

## Ajuste pós-FASE 09 — duplicidade em passagem_pedagio (2026-09-11)

Ao testar o cruzamento GPS×passagem, o usuário tinha reimportado o mesmo
`teste_pedagio.csv` de passagens 3 vezes durante a depuração dos ajustes
anteriores — como `passagem_pedagio` não tinha nenhuma trava contra
duplicidade (diferente de `posicao_veiculo`, que já ganhou `unique` na
FASE 09), isso deixou **19 linhas duplicadas** no banco.

**Erro cometido na limpeza:** a primeira tentativa de deduplicar usou a
chave (`numero_fatura`, `placa_informada`, `data_hora`) — mas 3 pares de
linhas legítimas de débito+crédito (mesma passagem, condição/valor
diferentes) compartilham exatamente essa combinação. O `DELETE` acabou
removendo 3 linhas de crédito reais, não duplicatas. Corrigido apagando
o lote de teste inteiro e reimportando o arquivo original uma vez (dado
100% de teste, sem impacto real).

**Correção definitiva** (migration
`20260911173126_pedagio_fix_duplicidade_passagem_pedagio`):
- `unique (placa_informada, data_hora, condicao, valor_cobrado)` em
  `passagem_pedagio` — a chave inclui `condicao`/`valor_cobrado`
  justamente para não colidir com pares débito/crédito legítimos.
- `processar_staging_passagens` ganhou `on conflict ... do nothing`,
  contando a linha duplicada como erro do lote (mesmo padrão já usado em
  `processar_staging_posicoes` na FASE 09).

**Verificação:** reimportar as 16 linhas reais duas vezes seguidas — 1ª
vez 16/16 sem erro (pares débito/crédito preservados), 2ª vez (mesmo
arquivo) 16/16 erro por duplicidade, sem criar nenhuma linha nova.
Dados de teste da verificação removidos ao final.

**Limitação conhecida (decisão adiada):** uma fatura reemitida/corrigida
pelo fornecedor com veículo+horário+condição+valor idênticos ao
original seria silenciosamente tratada como duplicata (a chave não inclui
`numero_fatura`). Revisitar se esse cenário aparecer no uso real.

---

## FASE 10 — Cadastro próprio de viagem/embarcador

**Status:** 🟢 Concluído

**Objetivo:** sair dos campos texto livre `viagem`/`embarcador` em
`passagem_pedagio` para tabelas com FK, permitindo filtro/relatório mais
confiável — único item que ainda restava das "Decisões em aberto".

**Decisões fechadas (2026-09-11):**
- Escopo de `embarcador`: nome + CNPJ opcional (sem contato/endereço).
- Escopo de `viagem`: só o número/código (sem origem/destino/data/veículo
  — vira só uma tabela de apoio pra dar FK).
- Cadastro: **automático na importação** (mesmo espírito do
  `sem_cadastro` de veículo/praça, mas aqui cria em vez de só marcar —
  não existe "bloqueio" para viagem/embarcador).

**Checklist:**
- [x] Tabelas `pedagio.viagem` (`numero` unique) e `pedagio.embarcador`
  (`nome` unique, `cnpj` opcional)
- [x] RLS: leitura para qualquer autorizado, insert para qualquer
  autorizado (precisa pro auto-cadastro funcionar com operador
  importando), update/delete só admin (só o CNPJ é editável, e só por
  admin)
- [x] `passagem_pedagio`: colunas `viagem`/`embarcador` renomeadas para
  `viagem_informada`/`embarcador_informada` (texto bruto da planilha,
  mesmo padrão de `placa_informada`/`praca_informada`); colunas novas
  `viagem_id`/`embarcador_id` (FK, nullable)
- [x] `vw_passagens_detalhado` atualizada: mantém as colunas `viagem`/
  `embarcador` com os nomes de sempre (sem quebrar o frontend existente,
  que já lia esses nomes) e acrescenta `viagem_id`/`embarcador_id`
- [x] `processar_staging_passagens`: auto-cadastra viagem/embarcador
  quando o código/nome da planilha ainda não existe
- [x] Frontend: aba "Embarcadores" em Cadastros (lista + edição de CNPJ,
  admin-only; sem formulário de criação — só aparece o que foi
  auto-cadastrado); filtro por Embarcador (dropdown) e Viagem (busca por
  texto) na tela de Passagens
- [x] `get_advisors` — sem achados novos além do padrão já esperado
- [x] Verificação via SQL direto: reimportei as 16 linhas reais do
  arquivo de teste — 16/16 sem erro, 3 viagens e 2 embarcadores
  auto-cadastrados corretamente (inclusive as duas linhas do mesmo
  embarcador em viagens diferentes apontando pro mesmo `embarcador_id`)
- [x] Verificação via REST com usuários reais (admin/operador): operador
  insere viagem/embarcador (necessário pro auto-cadastro), operador não
  consegue editar CNPJ (RLS rejeita), admin consegue — 5/5 checks, zero
  resíduo
- [x] `typecheck`/`eslint`/`next build` limpos
- [x] `docs/modelo-dados.md` e `docs/importacao.md` atualizados

**Notas de implementação:**
- Migration aplicada: `20260911174336_pedagio_fase10_viagem_embarcador`
  (mirror local em `supabase/migrations/`).
- Não existe tela de cadastro pra `viagem` — não haveria o que gerenciar
  além do número, que já vem certo da planilha. O valor da FK é só
  permitir agrupar/filtrar; se um dia precisar de mais campos (origem,
  destino, data), a tabela já existe pra receber.
- Casamento de embarcador é case-insensitive (`upper(nome)`) para não
  criar quase-duplicatas por variação de maiúsculas/minúsculas entre
  importações; `viagem.numero` é comparado exato (números de viagem não
  têm essa ambiguidade).

---

## Ajuste pós-FASE 07 — linha inválida não pode abortar o lote (2026-09-11)

**Problema real:** ao importar uma planilha real de passagens, a primeira
linha do primeiro envio chegou na staging sem `praca_nome`/`sentido`.
Isso violava a constraint not null de `passagem_pedagio.praca_informada`
e lançava uma exceção não tratada dentro do loop de
`processar_staging_passagens` — abortando a transação inteira (o
`lote_importacao` nem chegava a ser confirmado) e, pior, **sem limpar a
`staging_passagem_pedagio`** (o insert na staging é uma chamada separada,
fora da transação da função). Resultado: toda nova tentativa de
reimportar reprocessava as linhas antigas acumuladas junto com as novas,
sempre falhando no mesmo ponto — o usuário reenviou o mesmo arquivo 4
vezes tentando resolver, acumulando 64 linhas na staging.

**Correção** (migration
`20260911180512_pedagio_fix_erro_linha_nao_aborta_lote`):
- `praca_nome`/`sentido` vazios agora são checados explicitamente e
  contados como erro da linha, mesmo padrão já usado para
  data/valor/tipo_uso/condicao inválidos.
- Todo o processamento de uma linha (lookup + insert) passou a rodar
  dentro de um bloco `begin/exception when others` — qualquer erro
  inesperado (constraint, etc.) é contado como erro daquela linha e o
  loop continua, nunca aborta o lote inteiro nem deixa lixo na staging.
- Staging poluída (64 linhas, resíduo das 4 tentativas do mesmo arquivo)
  limpa manualmente uma vez; reimportação seguinte: 16/16 sem erro.

---

## FASE 11 — Visibilidade das posições de GPS

**Status:** 🟢 Concluído

**Objetivo:** dar visibilidade aos pings de GPS já importados (FASE 09)
por veículo/período — hoje só existiam como dado bruto sem tela própria,
usado apenas internamente pela validação geoespacial.

**Decisões fechadas (2026-09-11):**
- Formato da tela: mapa (trajeto) **e** lista de pings juntos, não só um
  dos dois.
- Escopo: consulta somente leitura; sem edição/exclusão de pings aqui.

**Checklist:**
- [x] View `pedagio.vw_posicao_veiculo` (lat/lon extraídos do `geom` via
  `ST_Y`/`ST_X`, join com `veiculo` pra trazer a placa), `security_invoker
  = true` — herda a policy de leitura já existente (`usuario_autorizado`)
- [x] Página `/rastreamento`: filtro por veículo (obrigatório escolher
  um) + período opcional; mapa com trajeto (polyline + marcador por
  ping, Leaflet puro, mesmo padrão do `PolygonMapEditor`) e lista de
  pings (data/hora, lat, lon, fonte) lado a lado
- [x] Link "Rastreamento" no menu, visível para qualquer autorizado
- [x] `typecheck`/`eslint`/`next build` limpos
- [x] Verificação: SQL direto confirmou lat/lon extraídos batendo com os
  pings reais já importados; REST sem autenticação contra a view nova
  retornou 401/permission denied (mesmo comportamento das demais
  tabelas do schema); rota `/rastreamento` responde 307 → `/login`
  quando não autenticado (sem erro de servidor)

**Limitação conhecida:** não testei visualmente no navegador com sessão
autenticada (sem ferramenta de browser neste ambiente) — validado via
build/typecheck/lint + consultas SQL/REST diretas. Vale conferir
visualmente na primeira vez que usar.

---

## Ajuste pós-FASE 04/09 — fuso horário na importação (2026-09-11)

**Problema real:** usuário importou uma posição de GPS informando
`20:11:00` e o app exibiu `17:11:00`. `parse_data_hora_planilha` usava
`to_timestamp(...)`, que trata o texto da planilha (horário local do
Brasil) como se já fosse UTC — a posição ficava gravada como
`2026-08-31 20:11:00+00`, e a tela (convertendo UTC → horário local,
Brasil = UTC-3) mostrava 3h a menos. Afetava igualmente
`passagem_pedagio` e `posicao_veiculo` (mesma função), então a
comparação relativa entre elas (janela de tolerância, geoespacial)
continuava correta — só a exibição do horário absoluto ficava errada.

**Efeito colateral encontrado:** `validar_passagem` comparava
`passagem.data_hora::date` (cast em UTC) contra a vigência da tarifa. Uma
passagem perto da meia-noite local, com o instante UTC corrigido, pode
"virar o dia" em UTC e cair fora da vigência cadastrada — a comparação
de vigência também precisava ser pela data local, não UTC.

**Correção** (migration `20260911193045_pedagio_fix_fuso_horario_importacao`):
- `parse_data_hora_planilha` agora interpreta a data/hora da planilha
  como horário de `America/Sao_Paulo` e converte corretamente para UTC
  antes de gravar.
- `validar_passagem` passa a comparar a vigência da tarifa pela data
  local (`data_hora at time zone 'America/Sao_Paulo'`), não UTC.
- Dados já importados corrigidos em massa (+3h em `passagem_pedagio` e
  `posicao_veiculo`) e todas as passagens revalidadas de novo, pra
  garantir consistência com a correção de vigência.

**Verificação:** `parse_data_hora_planilha('31/08/2026', '20:11:00')`
retorna `2026-08-31 23:11:00+00` (= 20:11:00 local, correto); a posição
de teste do usuário, antes gravada como `20:11:00+00`, ficou
`23:11:00+00` após a correção retroativa.

---

## FASE 12 — Mapa da validação geoespacial

**Status:** 🟢 Concluído

**Objetivo:** complementar visualmente o resultado "dentro do polígono"
já exibido em texto na tela de detalhe da passagem (`/passagens/[id]`),
mostrando o polígono da praça e o ping de GPS usado na validação num
mapa.

**Checklist:**
- [x] `vw_passagens_detalhado` ganhou a coluna `posicao_veiculo_id`
  (vindo de `validacao_passagem`), pra buscar o ping via
  `vw_posicao_veiculo` (já existe, FASE 11) sem view nova
- [x] Componente `MapaValidacao` (Leaflet puro, somente leitura):
  desenha o polígono da praça e, se houver ping associado, um marcador
  colorido conforme `dentro_poligono` (verde = dentro, vermelho = fora,
  cinza = sem dado)
- [x] Seção "Mapa da validação" em `/passagens/[id]`, usando o polígono
  já exposto por `vw_praca_pedagio_mapa` (mesma view do cadastro de
  praças); quando a praça não foi identificada (`sem_cadastro`), mostra
  mensagem em vez do mapa
- [x] `typecheck`/`eslint`/`next build` limpos
- [x] `get_advisors` — sem achados novos
- [x] Verificação: SQL confirmou `posicao_veiculo_id` chegando certo na
  view para os casos com/sem ping; REST sem autenticação continua
  bloqueado (permission denied)

**Limitação conhecida:** mesma das fases anteriores — não testei
visualmente no navegador (sem ferramenta de browser neste ambiente).

---

## FASE 13 — Viagem completa (documento fiscal)

**Status:** 🟢 Concluído

**Objetivo:** importar o documento fiscal/transporte (planilha do
sistema de logística) pra saber se o veículo viajou carregado ou vazio e
com qual embarcador — entidade independente de `pedagio.viagem` (FASE
10), que vem da numeração da planilha de passagens.

**Formato real confirmado com o usuário (2026-09-11):** `placa`,
`numero_transporte`, `cidade_origem`/`uf_origem`, `cidade_destino`/
`uf_destino`, `data_hora_saida`/`data_hora_chegada` (data+hora num único
campo `DD/MM/YYYY HH24:MI`, diferente das outras planilhas),
`carreta1`/`carreta2` (placa/código da carreta — preenchido indica 6/7 ou
9 eixos), `tipo_viagem` (`CARREGADO`/`VAZIO`, forma real do fornecedor).

**Checklist:**
- [x] Tabela `pedagio.viagem_transporte` (`numero_transporte` unique,
  `veiculo_id` fk nullable, `embarcador_id` fk nullable, demais colunas
  conforme planilha) + `staging_viagem_transporte`
- [x] `lote_importacao_tipo_check` ganhou `'viagens_transporte'`
- [x] `pedagio.parse_data_hora_combinada` — parser novo pro formato
  data+hora num único campo, mesmo tratamento de fuso do fix pós-FASE
  04/09 (interpreta como `America/Sao_Paulo`, converte pra UTC)
- [x] `pedagio.normalizar_tipo_viagem` — aceita `carregado`/`vazio` (real
  do fornecedor) e `carregada`/`vazia`, case-insensitive
- [x] `processar_staging_viagens_transporte`: casa placa → veiculo (sem
  erro se não achar, mesmo espírito do "sem_cadastro"), descobre
  `embarcador_id` cruzando placa + janela saída/chegada contra
  `passagem_pedagio.embarcador_informada` (pega o mais antigo dentro da
  janela com embarcador preenchido), bloqueia duplicidade por
  `numero_transporte` (`on conflict do nothing`), erro por linha nunca
  aborta o lote (mesmo padrão do fix pós-FASE07)
- [x] View `vw_viagem_transporte_detalhado` (junta nome do embarcador)
- [x] Frontend: seção "Nova importação de viagens (documento fiscal)" em
  `/importacao`; tela `/viagens-transporte` (filtro por veículo/tipo/
  embarcador/período, tabela com origem→destino, saída/chegada, tipo,
  embarcador); `LoteList` ganhou label "Viagens"; link no menu
- [x] `typecheck`/`eslint`/`next build` limpos
- [x] `get_advisors` — sem achados novos
- [x] Verificação via SQL direto com a planilha de exemplo real (2
  linhas, mesmo veículo, uma viagem carregada e uma vazia): 2/2 sem
  erro, veículo casado, embarcador descoberto corretamente só na viagem
  cuja janela continha uma passagem com embarcador (a vazia ficou sem,
  como esperado); reimportar as mesmas 2 linhas: 2/2 erro por
  duplicidade, sem linha nova. Dados de teste removidos ao final.

**Limitação conhecida:** não testei visualmente no navegador (sem
ferramenta de browser neste ambiente). A regra de cruzamento de
embarcador (mais antigo dentro da janela) é uma heurística inicial — se
aparecer caso real com mais de um embarcador possível na mesma janela,
revisitar.

**Ajuste (2026-09-11) — coluna "Valor pedágios" em `/viagens-transporte`:**
`vw_viagem_transporte_detalhado` ganhou `valor_pedagios` — soma
`valor_cobrado` das passagens reais (`tipo_uso = 'passagem'`, decisão do
usuário: contrato fica de fora) da mesma placa dentro da janela saída/
chegada. Débito e crédito juntos, então o valor é líquido (crédito
reduz). Também corrigido: faltava índice em `viagem_transporte.
lote_importacao_id` (padrão já usado em `posicao_veiculo`/
`passagem_pedagio`, `get_advisors` pegou o esquecimento).

**Ajuste (2026-09-11) — colunas "Valor praça (tarifa)" e "Divergência":**
`vw_viagem_transporte_detalhado` ganhou `valor_tarifa_esperada` (soma
`validacao_passagem.valor_esperado` do mesmo conjunto de passagens de
`valor_pedagios`) e `divergencia_valor` (`valor_pedagios -
valor_tarifa_esperada`, mesma direção do `divergencia_valor` já existente
em `passagem_pedagio`). Implementado com `left join lateral` pra somar
os dois valores numa única passada e permitir a subtração sem repetir a
subquery. Também ajustado: `DataTable` (componente compartilhado) tinha
colunas grudadas por falta de padding horizontal — ganhou `pr-4`/
`last:pr-0`, corrigindo espaçamento em todas as tabelas do app, não só em
Passagens. E a tabela de Passagens ganhou um "semáforo" (bolinha colorida
por `STATUS`/`STATUS_VALIDACAO_INFO`, mesma paleta do detalhe da
passagem) ao lado do status em cada linha.

**Ajuste (2026-09-11) — exclusão de registros (admin-only):** Passagens,
Rastreamento (posições de GPS), Viagens de transporte e o histórico de
lotes em Importação ganharam seleção múltipla + botão "Excluir
selecionados" (só visível para admin, escondido pra operador). Backend:
- `validacao_passagem_passagem_id_fkey` virou `on delete cascade`
  (excluir a passagem leva a validação junto).
- `validacao_passagem_posicao_veiculo_id_fkey` virou `on delete set
  null` — excluir um ping de GPS não apaga a validação, só a evidência;
  a(s) passagem(ns) afetada(s) são revalidadas na hora (dentro da mesma
  função), pra não deixar status desatualizado (ex.: continuar "ok" sem
  nenhum ping de evidência).
- Funções `pedagio.excluir_passagens`, `excluir_posicoes`,
  `excluir_viagens_transporte` e `excluir_lote_importacao` (essa última
  remove passagens/posições/viagens do lote e o próprio lote, numa
  transação só) — todas com checagem explícita de `eh_admin()` (além da
  policy RLS `exclusao_admin` que já existia nas 4 tabelas desde as
  fases originais).
- Frontend: `DataTable` (componente compartilhado) ganhou suporte
  opcional a seleção (checkbox por linha + "selecionar todos"); hook
  `useSelecaoExclusao` compartilhado entre as 4 telas cuida do estado de
  seleção + confirmação (`window.confirm`) + chamada da server action.
- Verificação: SQL direto simulando admin (`set local
  request.jwt.claims`) — excluir posição revalida a passagem afetada
  (status saiu de resultado com evidência para `sem_dados_gps`); excluir
  passagem arrasta a validação (cascade); excluir lote remove viagem de
  transporte + o lote; usuário sem papel admin bloqueado em todas.
  `get_advisors` sem achados novos. Dados de teste removidos ao final,
  zero resíduo.

**Ajuste (2026-09-11) — dash "Passagens por tipo de uso" no Painel:** nova
view `vw_valores_por_tipo_uso_mensal` (`mes, tipo_uso, qtd_passagens,
total_cobrado`, agrupada a partir de `vw_passagens_detalhado`). No Painel,
seção nova com 4 cards (total e quantidade de `passagem` e de `contrato`)
+ gráfico de tendência mensal (`ValoresTipoUsoChart`, mesmo padrão visual
do gráfico "Cobrado vs. esperado" já existente) comparando os dois tipos
de uso mês a mês. Pivotamento do formato longo da view para o formato
largo do gráfico (uma coluna por tipo_uso) feito em `queries.ts`, mesmo
padrão já usado para `volumeTotalPorDia`. Verificado com os dados reais
importados (1 `contrato` de R$25,30 e 4 `passagem` somando R$77,96, ambos
em setembro/2026) batendo com o SQL agregado direto na tabela.
`typecheck`/`eslint`/`next build` limpos; `get_advisors` sem achados
novos.

**Ajuste (2026-09-11) — dash "Passagens por vínculo de viagem" no Painel:**
nova view `vw_valores_por_vinculo_viagem_mensal` classifica cada passagem
(só `tipo_uso = 'passagem'`) em `carregado`/`vazio`/`sem_vinculo` casando
placa + `data_hora` dentro da janela saída/chegada de `viagem_transporte`
(`left join lateral`, `order by data_hora_saida limit 1` — mesma
heurística de desempate já usada para descobrir `embarcador_id` na
importação de viagens de transporte, já que uma passagem pode cair
teoricamente dentro de mais de uma janela). No Painel, seção nova com 6
cards (valor + quantidade dos 3 vínculos) + gráfico de tendência mensal
(`ValoresVinculoViagemChart`, 3 linhas). Paleta ganhou o 3º slot
categórico validado (`aqua`, `#1baf7a`) em `colors.ts` para a terceira
série. Verificado com os dados reais: 1 passagem de UGF9B40 caiu dentro
da janela da viagem `carregado` (R$25,33); as outras 3 passagens reais
(JCY6G24 x2, JDK8C84) não bateram placa com nenhuma viagem de transporte
cadastrada → `sem_vinculo` (R$52,63); `contrato` fica fora da conta,
como já decidido para `valor_pedagios`. `typecheck`/`eslint`/`next
build` limpos; `get_advisors` sem achados novos.

---

## FASE 14 — Tarifa por composição real (cavalo + carreta(s))

**Status:** 🟢 Concluído

**Objetivo:** corrigir um problema estrutural apontado pelo usuário
(2026-09-11): a planilha de passagens só traz a placa do cavalo
mecânico, nunca da(s) carreta(s) — mas o número de eixos (e portanto a
tarifa correta) depende da composição real: cavalo (3 eixos) + carreta
comum (3 eixos) = 6; + vanderleia (4 eixos) = 7; + duas carretas (bitrem)
= 9. Até aqui a tarifa sempre usava a categoria fixa cadastrada no
veículo, ignorando qual carreta estava engatada naquela viagem
específica — `categoria_veiculo` já tinha `EIXO_6`/`EIXO_7`/`EIXO_9`
prontos, mas nada os alimentava dinamicamente.

**Decisões tomadas com o usuário:**
- Criar cadastro de carretas (`pedagio.carreta`: placa/código → tipo
  comum [3 eixos] ou vanderleia [4 eixos]) — sem isso não dá pra saber
  quantos eixos uma carreta adiciona, já que `viagem_transporte.carreta1`/
  `carreta2` só guardam a placa/código, não o tipo.
- Quando não for possível determinar a composição (sem viagem de
  transporte casando a janela, ou carreta não cadastrada), cai no
  comportamento antigo: usa a categoria cadastrada do veículo
  (fallback), em vez de deixar a passagem sem tarifa nenhuma.

**Checklist:**
- [x] Tabela `pedagio.carreta` (`placa` unique, `tipo` check comum/
  vanderleia) + RLS (leitura autorizados, escrita admin — mesmo padrão
  de `veiculo`)
- [x] `pedagio.categoria_por_composicao(placa, data_hora)`: acha a
  `viagem_transporte` da janela (mesma heurística de desempate do
  vínculo de embarcador — `order by data_hora_saida limit 1`), soma
  eixos de cavalo (3, fixo) + carreta1 + carreta2 (via cadastro
  `pedagio.carreta`), resolve `categoria_veiculo` por `codigo = 'EIXO_'
  || total`; retorna `null` se não der pra determinar (sem viagem, sem
  carreta1, ou carreta não cadastrada)
- [x] `validar_passagem` passa a resolver a categoria em duas etapas
  (composição real → fallback cadastro do veículo) e grava as duas
  novas colunas de `validacao_passagem`: `categoria_veiculo_id` (qual
  categoria foi usada) e `origem_categoria` (`composicao_viagem` \|
  `cadastro_veiculo`), pra dar transparência/auditoria
- [x] Revalidação automática (mesmo espírito da revalidação por exclusão
  de GPS já existente): importar uma viagem de transporte revalida as
  passagens que passam a cair na janela dela; cadastrar/alterar/excluir
  uma carreta (trigger) revalida as passagens afetadas; excluir uma
  viagem de transporte ou um lote inteiro revalida de volta pro fallback
  as passagens que dependiam dela (`excluir_viagens_transporte`/
  `excluir_lote_importacao` reescritas pra capturar as passagens
  afetadas antes de excluir, mesmo padrão do `excluir_posicoes`)
- [x] `vw_passagens_detalhado` ganhou `categoria_veiculo_id`,
  `origem_categoria`, `categoria_codigo`, `categoria_descricao` (colunas
  novas sempre no final, restrição do Postgres pra `CREATE OR REPLACE
  VIEW`)
- [x] Frontend: cadastro `/cadastros/carretas` (admin cria, qualquer
  autorizado lê); detalhe da passagem mostra "Categoria usada (tarifa)"
  + "Origem da categoria"; listagem de passagens ganhou coluna
  "Categoria" (com "(estimado)" quando é fallback, pra deixar claro
  quando o valor esperado não é garantido pela composição real)
- [x] `typecheck`/`eslint`/`next build` limpos
- [x] `get_advisors` — pegou índice faltante em
  `validacao_passagem.categoria_veiculo_id`, corrigido
- [x] Verificação via SQL direto: `categoria_por_composicao` testado nos
  5 casos (6 eixos, 7 eixos, 9 eixos, carreta não cadastrada, sem viagem
  de transporte) — todos corretos; passagem de teste confirma que
  cadastrar a carreta depois da passagem já existir revalida
  automaticamente e troca o valor esperado; excluir a viagem de
  transporte reverte pro fallback automaticamente. Dados reais (4
  passagens, carreta real `ABC1234` ainda não cadastrada) seguem
  corretamente em fallback até a carreta ser cadastrada de verdade.
  Dados de teste removidos ao final, zero resíduo.

**Limitação conhecida:** não testei visualmente no navegador (sem
ferramenta de browser neste ambiente). A heurística de desempate (viagem
de transporte mais antiga dentro da janela) é a mesma já usada pro
vínculo de embarcador — se aparecer caso real com mais de uma viagem
possível na mesma janela, revisitar. Categoria pra cavalo sozinho sem
nenhuma carreta (3 eixos) não existe ainda em `categoria_veiculo`
(`EIXO_3`) — não observado nos dados reais até agora; se acontecer,
cadastrar a categoria normalmente.

---

## Ajuste — exclusão de tarifas (admin-only) (2026-09-12)

**Pedido do usuário:** cadastro de tarifas precisa de forma de excluir uma
tarifa cadastrada por engano — restrita a admin, pelo risco financeiro de
uma tarifa equivocada em produção.

- A policy RLS `exclusao_admin` em `tarifa_praca` já existia desde a FASE
  08 (`insercao_admin`/`atualizacao_admin`/`exclusao_admin` só
  `eh_admin()`); faltava só a exposição no app — mesma lacuna do restante
  dos cadastros (categoria/veículo/carreta/praça ainda não têm exclusão
  pela UI).
- Função `pedagio.excluir_tarifas(p_ids uuid[])` (migration
  `20260912103000_pedagio_exclusao_admin_tarifas`), mesmo padrão de
  `excluir_passagens`/`excluir_posicoes`/`excluir_viagens_transporte`
  (checagem explícita de `eh_admin()` dentro da função, além da RLS).
  `tarifa_praca` não tem nenhuma tabela dependente, então a exclusão é
  direta, sem revalidação em cascata.
- Frontend: `TarifaList` ganhou seleção múltipla + botão "Excluir
  selecionadas" (reaproveitando `DataTable` com `selecao` e o hook
  `useSelecaoExclusao`, mesmo padrão já usado em Passagens/Rastreamento/
  Viagens de transporte/lotes de Importação), visível só quando
  `papel === "admin"`; nova server action `excluirTarifas` em
  `features/cadastros/actions.ts`.
- `typecheck`/`eslint`/`next build` limpos; `get_advisors` sem achados
  novos.
- Verificação via REST com usuários reais (admin/operador criados via
  Admin API): operador bloqueado ao chamar `excluir_tarifas` (RPC retorna
  o erro esperado, tarifa continua no banco), admin exclui com sucesso —
  6/6 checks, dados de teste (usuários, categoria, praça, tarifas)
  removidos ao final, zero resíduo.

---

## FASE 15 — Dashboard de faturas

**Status:** 🟢 Concluído

**Objetivo:** hoje `numero_fatura` só existe como coluna de exibição por
passagem (sem nenhuma agregação) — cada linha da planilha de passagens vem
vinculada a uma fatura que mistura passagem física e contrato, mas não há
como ver o valor total daquela fatura, o período que ela cobre, nem se há
algo pendente de revisão antes de pagar. Esta fase cria uma visão por
fatura: lista agregada + detalhe com drill-down.

**Decisões fechadas (2026-09-12):**
- Escopo: lista `/faturas` (resumo agregado) **e** detalhe `/faturas/[numero]`
  (breakdown + passagens daquela fatura).
- `numero_fatura` nulo: agrupado como uma linha própria "Sem fatura" (não
  excluído da agregação).
- "Valor total a pagar": líquido — passagem + contrato, débito/crédito
  somados (mesma convenção já usada nas views financeiras existentes,
  crédito já é negativo).
- Resumo por fatura inclui contagem por `status_validacao`, para sinalizar
  fatura com passagem divergente/sem_cadastro/fora_poligono pendente de
  revisão antes de pagar.

**Checklist:**
- [x] View `pedagio.vw_fatura_resumo` (agrupada por `numero_fatura`,
  tratando `null` como bucket próprio): valor total líquido, período
  (min/max `data_hora`), contagem de passagens, breakdown por `tipo_uso`
  (passagem/contrato — valor e quantidade de cada), contagem por
  `status_validacao`
  `security_invoker = true`, mesma convenção das views existentes
- [x] Página `/faturas`: lista com valor total, período, quantidade de
  passagens, indicador visual de pendência (baseado no breakdown de
  status), filtro por período; reaproveita `DataTable`
- [x] Página `/faturas/[numero]`: breakdown financeiro (passagem vs.
  contrato), breakdown por status de validação, breakdown por praça/
  veículo, lista das passagens daquela fatura (reaproveitando
  `PassagensTable`/`vw_passagens_detalhado`, já existentes de `/passagens`)
- [x] Link "Faturas" no header
- [x] `get_advisors` — sem achados novos (índice novo aparece como "unused"
  até a primeira consulta real, mesmo padrão de todo índice recém-criado)
- [x] Verificação via SQL direto: casos com fatura com só passagem, só
  contrato, mistura dos dois, fatura com passagem divergente/sem_cadastro,
  e fatura nula — valores/período/contagens batendo com o esperado;
  cleanup confirmado (zero resíduo)
- [x] Verificação via REST: `anon` bloqueado (`permission denied for schema
  pedagio`, mesmo comportamento de todas as demais tabelas/views do
  schema) — ver limitação abaixo sobre teste com usuário autenticado real
- [x] `typecheck`/`eslint`/`next build` limpos
- [x] `docs/indicadores.md` atualizado (a view nova documentada na seção
  Financeiro; `modelo-dados.md` não mudou — nenhuma tabela/coluna nova
  nesta fase, só índice + view)

**Notas de implementação:**
- Migration aplicada: `20260912113000_pedagio_fase15_dashboard_faturas.sql`
  (mirror local em `supabase/migrations/`) — cria o índice
  `passagem_pedagio_numero_fatura_idx` (nenhum índice existia em
  `numero_fatura` até aqui, apesar de já ser usada em filtro/exibição desde
  a FASE 07) e a view `pedagio.vw_fatura_resumo`.
- `GROUP BY numero_fatura` já trata todos os valores `null` como um único
  grupo no Postgres — não foi preciso `coalesce`/tratamento especial para
  o bucket "sem fatura" na view; só no frontend (label "Sem fatura" e a
  rota usa o segmento literal `sem-fatura` para representar esse grupo,
  já que `null` não é representável na URL).
- Contagem "pendente" da lista/detalhe (`qtdAtencao` em
  `features/faturas/queries.ts`) é derivada em TypeScript
  (`qtd_total - qtd_ok - qtd_nao_aplicavel`), não uma coluna da view — evita
  mais uma coluna só pra uma subtração simples que já tem todos os
  componentes disponíveis.
- Breakdown por praça/veículo na tela de detalhe é calculado em JS a partir
  das passagens já buscadas para aquela fatura (`agruparPorChave` em
  `app/(app)/faturas/[numero]/page.tsx`) — não virou view nova, o volume
  por fatura é pequeno (dezenas de linhas) e não justifica.
- `StatTile` (antes só usado pelo Painel) foi movido de
  `features/dashboard/components/` para `components/ui/` — passou a ser
  usado também pela tela de fatura, mesmo precedente já aberto na FASE
  06.4 para `DataTable`/`Card`/`EmptyState`.
- Tela de detalhe reaproveita `PassagensTable` (mesmo componente de
  `/passagens`, incluindo seleção múltipla + exclusão admin-only) para
  listar as passagens da fatura — sem paginação nessa lista (uma fatura
  isolada não tem volume que justifique).
- Filtro de período em `/faturas` usa lógica de sobreposição (`periodo_fim
  >= dataInicio` e `periodo_inicio <= dataFim`), não igualdade de uma
  única coluna de data — diferente dos outros filtros de período do app,
  porque aqui cada linha representa um intervalo (a fatura), não um
  instante.

**Limitação conhecida:** a verificação via REST desta fase não incluiu um
usuário autenticado real criado via Admin API (padrão das fases
anteriores) — esta sessão não tinha a `service_role key` disponível para
criar um usuário de teste descartável. A cobertura ficou em: (1) lógica de
agregação validada com dados sintéticos via SQL direto (todos os casos
batendo, cleanup confirmado), e (2) `anon` bloqueado via REST igual a
todas as demais tabelas/views. Isso é uma garantia mais fraca que o padrão
usual do projeto, porque `vw_fatura_resumo` não introduz nenhuma policy
nova — é `security_invoker = true` sobre `passagem_pedagio`, cuja policy
de leitura (`usuario_autorizado()`) já foi extensivamente verificada com
usuários reais na FASE 08. Recomenda-se conferir visualmente em
`/faturas` com um usuário real na primeira vez que usar.

---

## FASE 16 — Quantidade de eixos na categoria + cadastro único de veículo/carreta

**Status:** 🟢 Concluído

**Objetivo:** hoje `categoria_veiculo` só representa a **composição total**
usada na tarifa (`EIXO_6`/`EIXO_7`/`EIXO_9`, todas com "CAVALO ... MAIS
..." na descrição) — não existe um número de eixos de verdade, só embutido
no texto do `codigo`. E `carreta` é um cadastro à parte, sem categoria nem
frota, com um campo solto `tipo` (`comum`/`vanderleia`) que hoje é o único
jeito de saber quantos eixos uma carreta acrescenta. Esta fase: (1) dá a
`categoria_veiculo` um campo real `quantidade_eixos`; (2) une `veiculo` e
`carreta` num cadastro só, cada linha com categoria (agora carregando
eixos) e frota, mesmo processo que `veiculo` já tem hoje.

**Decisões fechadas (2026-09-13):**
- Cadastro único: **mesma tabela** `pedagio.veiculo`, com coluna nova
  `tipo` (`cavalo` \| `carreta`) para diferenciar — uma única tela/CRUD
  pros dois, filtrando por tipo. Tabela `pedagio.carreta` é **removida**
  depois de migrar as linhas existentes para `veiculo`.
- `categoria_veiculo.categoria_veiculo_id` em `veiculo` muda de sentido:
  passa a significar **os eixos do próprio veículo/carreta** (cavalo ≈ 3,
  carreta comum = 3, carreta vanderleia = 4) — não mais a categoria de
  tarifa. Usada por `categoria_por_composicao` para somar a composição
  real em vez dos valores fixos hardcoded que existem hoje (cavalo
  sempre 3, carreta por `tipo` comum/vanderleia).
- Fallback de tarifa **continua existindo** (decisão do usuário): como
  `categoria_veiculo_id` deixa de servir pra isso, `veiculo` ganha uma
  coluna nova `categoria_fallback_id` (fk `categoria_veiculo`, só
  aplicável a `tipo = 'cavalo'`) — é o que `validar_passagem` usa quando
  `categoria_por_composicao` não consegue determinar a composição real
  (sem viagem de transporte casando, ou carreta não cadastrada). Migração
  dos 4 veículos reais: `categoria_veiculo_id` atual (`EIXO_6`, usado hoje
  só como fallback) vira `categoria_fallback_id`; `categoria_veiculo_id`
  passa a apontar pra uma categoria nova "eixos próprios do cavalo" (3).
- Categorias novas a criar (reaproveitáveis entre cavalo e carreta comum,
  já que ambos têm fisicamente 3 eixos — não precisa duplicar por tipo de
  veículo): uma categoria com `quantidade_eixos = 3` (cavalo sozinho e
  carreta comum) e uma com `quantidade_eixos = 4` (carreta vanderleia).
  As 3 categorias de composição existentes (`EIXO_6`/`7`/`9`) recebem
  `quantidade_eixos` = 6/7/9 e continuam sendo usadas em `tarifa_praca` e
  como fallback — nada muda pra elas, só ganham o número.
- Resolução da tarifa por composição passa a ser por número
  (`categoria_veiculo.quantidade_eixos = total_somado`), não mais por
  string (`codigo = 'EIXO_' || total`) — mesmo resultado pros casos já
  cobertos (6/7/9), mas não depende mais do padrão de texto do `codigo`.

**Checklist:**
- [x] Migration: `categoria_veiculo` ganha `quantidade_eixos integer not
  null` (backfill: `EIXO_6`→6, `EIXO_7`→7, `EIXO_9`→9); insere as 2
  categorias novas (3 e 4 eixos)
- [x] Migration: `veiculo` ganha `tipo text not null default 'cavalo'
  check in ('cavalo','carreta')` e `categoria_fallback_id uuid null fk
  categoria_veiculo` (check: só pode ser preenchido se `tipo = 'cavalo'`)
- [x] Migração de dados: 4 veículos existentes — copiar
  `categoria_veiculo_id` atual (`EIXO_6`) para `categoria_fallback_id`,
  trocar `categoria_veiculo_id` pra categoria nova de 3 eixos; migrar as 2
  carretas existentes (`ABC1234` comum, `ABC5678` vanderleia) para linhas
  de `veiculo` com `tipo = 'carreta'`, `categoria_veiculo_id` = categoria
  de 3 ou 4 eixos conforme o `tipo` antigo, `categoria_fallback_id = null`
- [x] Dropar tabela `pedagio.carreta` (depois da migração de dados
  confirmada) — mover o trigger de revalidação (hoje em `carreta`) pra
  disparar em `veiculo` quando `tipo = 'carreta'` muda (placa/categoria)
- [x] Reescrever `pedagio.categoria_por_composicao`: eixos do cavalo vêm
  de `veiculo.categoria_veiculo_id` (join `quantidade_eixos`) em vez de
  constante 3; eixos de `carreta1`/`carreta2` vêm de `veiculo` (`tipo =
  'carreta'`, join `quantidade_eixos`) em vez de `carreta.tipo`; resolução
  final da categoria de tarifa por `quantidade_eixos = total` em vez de
  `codigo`
- [x] `validar_passagem`: fallback passa a usar
  `veiculo.categoria_fallback_id` em vez de `veiculo.categoria_veiculo_id`
- [x] RLS/policies: revisar policies de `veiculo` (hoje já
  admin-escreve/qualquer-autorizado-lê) — confirmar que cobrem `tipo =
  'carreta'` igual; policies próprias de `carreta` (FASE 14) somem junto
  com a tabela
- [x] `get_advisors` — checar índice em `categoria_fallback_id` e no novo
  padrão de lookup por `quantidade_eixos`
- [x] Frontend: cadastro de categoria (`/cadastros/categorias`) ganha
  campo `quantidade_eixos` no form e na lista
- [x] Frontend: unificar cadastro de veículo — form/lista de
  `/cadastros/veiculos` ganham seletor de `tipo` (cavalo/carreta),
  `categoria_fallback_id` (só aparece pra `tipo = cavalo`); remover
  `/cadastros/carretas`, `carreta-list.tsx`, `carreta-form.tsx` e a aba
  "Carretas" da navegação de Cadastros
- [x] Frontend: telas/queries que hoje leem `pedagio.carreta` (detalhe de
  passagem "Categoria usada", listagens que citam carreta) passam a ler
  `veiculo` filtrando `tipo = 'carreta'`
- [x] `docs/modelo-dados.md` atualizado (categoria com eixos, veiculo com
  tipo/categoria_fallback, remoção de `carreta`)
- [x] Script de verificação (`.mjs`, mesmo padrão das fases anteriores):
  reprocessar os casos reais de composição (6/7/9/carreta não
  cadastrada/sem viagem de transporte) confirmando que o valor esperado
  não muda em relação ao comportamento atual; fallback funcionando pro
  cavalo sem composição conhecida; CRUD do cadastro único (cavalo e
  carreta) via REST com usuário admin/operador reais
- [x] `typecheck`/`eslint`/`next build` limpos

**Risco principal:** esta fase mexe em `validar_passagem`/
`categoria_por_composicao`, que já rodam em produção contra dados reais
(4 veículos, 2 carretas, passagens e viagens de transporte importadas) —
a migração de dados dos 4 veículos/2 carretas existentes precisa
preservar exatamente o valor esperado que já estava sendo calculado antes
da mudança (verificação vai comparar antes/depois).

**Notas de implementação:**
- Migration aplicada: `pedagio_fase16_eixos_e_cadastro_unico` (mirror
  local em `supabase/migrations/`).
- Trigger de revalidação por carreta precisou virar **2 triggers** (INSERT/
  UPDATE com `when (new.tipo = 'carreta')`, DELETE com `when (old.tipo =
  'carreta')`) em vez de 1 só com `coalesce(new.tipo, old.tipo)` —
  Postgres rejeita (`42P17`) referenciar `NEW` na condição `WHEN` de um
  trigger que inclui `DELETE`, mesmo dentro de `coalesce`.
- Migração de dados real: os 4 veículos (cavalos) tiveram
  `categoria_veiculo_id` (`EIXO_6`) copiado para `categoria_fallback_id` e
  `categoria_veiculo_id` trocado pra `EIXO_3` (eixos próprios); as 2
  carretas (`ABC1234` comum, `ABC5678` vanderleia) migraram para `veiculo`
  com `tipo = 'carreta'`, `categoria_veiculo_id` = `EIXO_3`/`EIXO_4`
  conforme o `tipo` antigo — conferido linha a linha após a migration.
- Categorias novas: `EIXO_3` ("cavalo mecânico sozinho ou carreta comum",
  3 eixos) e `EIXO_4` ("carreta vanderleia", 4 eixos) — reaproveitando o
  padrão de código já usado (`EIXO_N`), só que agora `N` também é o valor
  real de `quantidade_eixos`, não só texto.
- Importação (`processar_staging_passagens`/`processar_staging_posicoes`/
  `processar_staging_viagens_transporte`): os `select ... from
  pedagio.veiculo where placa = ...` que resolvem `veiculo_id` ganharam
  `and tipo = 'cavalo'` — sem isso, depois da unificação, uma carreta
  poderia teoricamente ser casada como o veículo de uma passagem/posição
  de GPS/viagem de transporte (nunca deveria, carretas não passam pedágio
  nem carregam rastreador próprio). Não estava no checklist original, mas
  é consequência direta de unificar as tabelas.
- Verificação via SQL direto (dados `SEED*`, sem service_role key
  disponível nesta sessão pra criar usuário via Admin API — mesma
  limitação já registrada na FASE 15): `categoria_por_composicao` testado
  nos 5 casos (6/7/9 eixos, carreta não cadastrada, sem viagem de
  transporte) — resultados idênticos ao comportamento anterior à
  migration; trigger de revalidação testado ponta a ponta (passagem real
  de teste resolvida como `EIXO_6`/composição, categoria da carreta
  alterada de comum→vanderleia, passagem revalidada sozinha pra `EIXO_7`
  sem chamada explícita); `anon` via REST continua bloqueado
  (`permission denied for schema pedagio`, mesmo comportamento de sempre).
  Dados de teste removidos ao final, zero resíduo confirmado.
- Efeito colateral observado (não é bug desta fase): recalcular as 4
  passagens reais existentes (chamando `validar_passagem` de novo pra
  confirmar que a categoria resolvida não mudou) atualizou
  `valor_esperado`/`divergencia_valor` porque a tarifa de `EIXO_6` no
  banco hoje é R$65 — as validações antigas estavam com um valor de
  tarifa desatualizado (R$20) de quando foram calculadas. A categoria
  resolvida (`EIXO_6`, mesma origem `composicao_viagem`/`cadastro_veiculo`
  de antes) não mudou; só o valor da tarifa em si foi recalculado com o
  dado atual — resultado mais correto, não uma regressão da fase.
- `get_advisors` — sem achados novos além do índice `unused_index`
  esperado para qualquer índice recém-criado (`veiculo_categoria_
  fallback_id_idx`).
- `typecheck`/`eslint`/`next build` limpos.
- Não testado visualmente no navegador (sem ferramenta de browser neste
  ambiente) — recomenda-se conferir `/cadastros/categorias` e
  `/cadastros/veiculos` visualmente na primeira vez que usar, em especial
  o campo "Categoria de fallback" aparecendo/sumindo ao trocar o seletor
  de Tipo no formulário de veículo.

---

## Ajuste — edição e exclusão de veículo/carreta (admin-only) (2026-09-13)

**Pedido do usuário:** a tela de cadastro de veículo (FASE 16) ficou boa,
mas só tinha criação + listagem — faltava editar e excluir, restrito a
admin.

- Edição: passou a reaproveitar o mesmo padrão já usado em Praças — página
  própria `/cadastros/veiculos/[id]` (guard admin-only, redireciona pra
  listagem se não-admin) com o mesmo `VeiculoForm` da criação, agora
  aceitando um `veiculo` opcional pra pré-preencher os campos. Ação
  `criarVeiculo` virou `salvarVeiculo` (mesmo padrão de `salvarPraca`):
  branch insert/update pela presença de um `veiculo_id` oculto no form.
  Nenhuma migration necessária — a policy `atualizacao_admin` (UPDATE)
  já existia em `veiculo` desde a FASE 08, sem alteração.
- Exclusão: seleção múltipla + "Excluir selecionados" na listagem, mesmo
  padrão (`DataTable` com `selecao` + hook `useSelecaoExclusao`) já usado
  em Tarifas/Passagens/Rastreamento/Viagens de transporte/lotes de
  Importação. Função `pedagio.excluir_veiculos(p_ids uuid[])` (migration
  `pedagio_exclusao_admin_veiculos`), checagem explícita de `eh_admin()`
  dentro da função (mesmo padrão de `excluir_tarifas` etc.), além da RLS
  `exclusao_admin` já existente. Como nenhuma das 3 FKs que apontam pra
  `veiculo` (`posicao_veiculo`, `passagem_pedagio`, `viagem_transporte`)
  tem `on delete cascade`/`set null`, excluir um veículo/carreta com
  histórico vinculado é bloqueado pelo Postgres (`23503`) — a action
  traduz isso pra uma mensagem amigável em vez de vazar o erro técnico.
- Verificação via SQL direto (sem service_role key nesta sessão, mesma
  limitação já registrada nas FASEs 15/16): veículo de teste sem vínculos
  excluído com sucesso simulando admin, bloqueado simulando usuário sem
  papel (RPC lança exceção antes mesmo de tentar o delete); tentativa de
  excluir um veículo real com posições de GPS vinculadas rejeitada com
  `23503` dentro de uma transação revertida (nada alterado); `UPDATE`
  direto simulando admin retorna a linha alterada (`RETURNING`),
  simulando usuário sem papel retorna vazio (RLS bloqueia antes do
  update). Dados de teste removidos ao final, zero resíduo. `get_advisors`
  sem achados novos (a função nova é `SECURITY INVOKER`, sem o WARN que
  as `SECURITY DEFINER` já existentes recebem).
- `typecheck`/`eslint`/`next build` limpos.
- Não testado visualmente no navegador — recomenda-se conferir
  `/cadastros/veiculos` (editar um registro, tentar excluir um com e sem
  vínculo) visualmente na primeira vez que usar.

---

## Ajuste — edição e exclusão (admin-only) em categorias, praças, tarifas e
## embarcadores (2026-09-13)

**Pedido do usuário:** aplicar o mesmo conceito da tela de veículos (edição
+ exclusão restritas a admin) nas outras 4 telas de cadastro. Cada uma já
tinha uma peça faltando diferente:

| Tela | Já tinha | Faltava |
|---|---|---|
| Categorias | criar, listar | editar, excluir |
| Praças | criar, listar, **editar** | excluir |
| Tarifas | criar, listar, **excluir** | editar |
| Embarcadores | **editar CNPJ** (auto-cadastro, sem criação manual) | excluir |

- **Backend:** migration `pedagio_exclusao_admin_categorias_pracas_
  embarcadores` — 3 funções novas (`excluir_categorias`, `excluir_pracas`,
  `excluir_embarcadores`), mesmo padrão de `excluir_veiculos`/
  `excluir_tarifas` (checagem explícita de `eh_admin()`, `SECURITY
  INVOKER`, além da RLS `exclusao_admin` que já existia nas 4 tabelas
  desde a FASE 08). Nenhuma das FKs que apontam pra essas tabelas tem
  cascade/set null, então excluir um registro em uso é bloqueado pelo
  Postgres (`23503`) — cada action traduz isso numa mensagem amigável
  específica (ex.: "há veículos, tarifas ou passagens validadas usando
  esta categoria").
- **Categorias:** `criarCategoria` virou `salvarCategoria` (branch
  insert/update por `categoria_id` oculto, mesmo padrão de
  `salvarVeiculo`); página nova `/cadastros/categorias/[id]`; lista ganhou
  link na coluna Código (admin) + seleção múltipla/exclusão (mesmo padrão
  `DataTable`+`useSelecaoExclusao` das outras telas).
- **Praças:** só faltava excluir — `PracaList` virou client component,
  ganhou seleção múltipla/exclusão; edição (já existente desde a FASE
  06.4) não mudou.
- **Tarifas:** só faltava editar — `criarTarifa` virou `salvarTarifa`
  (branch insert/update por `tarifa_id` oculto); como a `EXCLUDE`
  constraint contra sobreposição de vigência vale tanto pra INSERT quanto
  UPDATE, o tratamento de erro `23P01` (já existente na criação) cobre a
  edição sem mudança; página nova `/cadastros/tarifas/[id]`; link de
  edição na coluna Praça da lista.
- **Embarcadores:** só faltava excluir — como a lista já é uma tabela
  customizada por linha (não `DataTable`) por causa do form inline de
  CNPJ, a exclusão virou um botão por linha (não seleção em lote como as
  outras telas) chamando `excluirEmbarcadores` com um array de 1 id;
  mesmo conceito (admin-only, RPC com checagem), UI adaptada ao formato
  já existente da tela em vez de forçar o padrão de seleção múltipla.
- Verificação via SQL direto (sem service_role key nesta sessão, mesma
  limitação já registrada nas fases/ajustes anteriores): as 3 funções
  novas testadas — não-admin bloqueado antes mesmo do delete; admin
  exclui com sucesso um registro de teste sem vínculo (categoria, praça e
  embarcador `SEED*`, removidos); tentativa de excluir um registro real
  em uso (categoria `EIXO_6`, praça `PRACA FRANCO DA ROCHA`, embarcador
  real) rejeitada com `23503` dentro de transação revertida (nenhum dado
  real alterado). `get_advisors` sem achados novos.
- `typecheck`/`eslint`/`next build` limpos.
- Não testado visualmente no navegador — recomenda-se conferir as 4 telas
  (editar/excluir com e sem vínculo) visualmente na primeira vez que usar.

---

## Estado atual

**Projeto completo (FASE 01 a FASE 16).** Schema `pedagio` (cadastros
incluindo viagem/embarcador e cadastro único de veículo/carreta com
eixos reais por categoria, movimento, validação com revalidação
automática, importação de passagens, de GPS e de viagens de transporte
(documento fiscal) no layout real do fornecedor, indicadores incluindo
resumo por fatura, papéis de acesso admin/operador, visibilidade de GPS
por veículo) + app Next.js (login compartilhado, dashboard, cadastros com
mapa, importação via UI, consulta de passagens/validações com mapa da
validação geoespacial, rastreamento de GPS, consulta de viagens de
transporte, dashboard de faturas, gestão de usuários) — tudo aplicado e
verificado no Supabase (`wduypqixkafimcndytiz`).

## Ajuste — modo escuro/claro de verdade + correção de contraste em
## `/usuarios` (2026-09-13)

**Pedido do usuário:** o `<select>` de papel em `/usuarios` estava com
cor de fonte clara (baixo contraste); e pediu uma opção de modo escuro/
claro no sistema todo.

**Descoberta ao investigar:** o app já tinha classes `dark:` do Tailwind
espalhadas por toda a UI desde a FASE 06, mas **nada nunca aplicava a
classe `.dark`** — nem detecção de preferência do sistema, nem toggle.
Ou seja, o modo escuro nunca funcionou de fato (sempre renderizava claro,
independente do SO) — só existia o CSS morto. O bug relatado (select de
papel sem cor de texto definida) era um sintoma à parte: como o modo
escuro nunca ligava, ninguém tinha notado esse `<select>` específico
faltando `text-gray-900 dark:text-gray-100` (os outros inputs/selects do
app usam o componente compartilhado `TextField`/`SelectField`, que já
tem essa cor; este era um `<select>` cru, escrito à mão).

**O que foi feito:**
- `usuarios-table.tsx`: `<select>` de papel ganhou `text-gray-900
  dark:text-gray-100` (mesmo padrão do `INPUT_CLASSES` compartilhado).
- Modo escuro real: script inline no início do `<body>` (`layout.tsx`)
  aplica a classe `.dark` em `<html>` antes da primeira pintura (lê
  `localStorage.theme`, senão `prefers-color-scheme`) — evita "flash" de
  tema errado. `ThemeToggle` (`components/theme-toggle.tsx`, ícone sol/
  lua) alterna a classe e persiste a escolha; adicionado no header
  (`AppHeader`, visível em todo o app autenticado) e na tela de `/login`.
- Hook `useTema` (`hooks/use-tema.ts`, via `useSyncExternalStore`
  observando mudanças de classe em `<html>` com `MutationObserver`) —
  forma correta de reagir à troca de tema sem cair em "setState dentro de
  effect" (`react-hooks/set-state-in-effect` do ESLint) nem gerar
  mismatch de hidratação.
- **Efeito colateral descoberto e corrigido:** os 5 gráficos do painel
  (recharts) usavam cores fixas em hexadecimal (`colors.ts`) só validadas
  pra fundo claro — como o modo escuro nunca tinha realmente ligado antes,
  ninguém tinha visto o problema. `colors.ts` ganhou uma segunda paleta de
  tinta neutra (`ink(tema)`, cores categóricas/sequencial continuam iguais
  nos dois temas) — os 5 componentes de gráfico agora calculam a cor de
  eixo/grid/legenda/contorno de ponto pelo tema atual via `useTema()`,
  em vez de importar `INK` fixo.
- `typecheck`/`eslint`/`next build` limpos.
- **Limitação honesta:** não há ferramenta de navegador/screenshot neste
  ambiente (confirmado de novo — sem `chromium-cli` disponível), então
  não vi visualmente o toggle nem o contraste corrigido. Recomendo
  fortemente conferir no navegador: alternar o tema no header/login, e
  abrir `/usuarios` e `/dashboard` nos dois modos. Se o dev server já
  estava aberto numa aba ociosa, pode ser necessário `F5` (problema
  conhecido do Next dev, não relacionado a esta mudança).

## FASE 17 — Divergência explicada (por causa, praça e veículo)

**Status:** 🟢 Concluído

**Objetivo:** o card "Divergência total" do Painel só mostrava um número
líquido agregado (`total_cobrado - total_esperado`), sem nenhuma forma de
saber de onde vinha aquele valor. Esta fase quebra a divergência em causas
explicáveis, mantendo uma visão de gestão (poucos números, não uma tela
analítica).

**Decisão fechada com o usuário (2026-09-14):** quebrar por status de
validação (a causa) **e** por praça/veículo (onde se concentra), mas como
visão gerencial — top 5 por maior desvio em módulo, não listagem completa.

**Checklist:**
- [x] 3 views novas (`security_invoker = true`, mesmo padrão da FASE 05):
  `vw_divergencia_por_status`, `vw_divergencia_por_praca`,
  `vw_divergencia_por_veiculo` — todas agregando `total_cobrado`,
  `total_esperado` e `divergencia_valor` (soma de `coalesce(divergencia_valor,
  0)`) a partir de `vw_passagens_detalhado`, ordenadas por
  `abs(divergencia_valor)` desc
- [x] Painel: nova seção "Divergência" (entre os StatTiles do topo e
  "Financeiro") com 3 cards: por causa (status), maiores desvios por praça,
  maiores desvios por veículo (top 5 em módulo, calculado em
  `queries.ts`, mesmo padrão já usado para os outros pivotamentos em JS)
- [x] Componente `DivergenciaValor` (cor critical/good pelo sinal, sempre com
  o número assinado no texto — nunca só cor) e `valorEsperadoLabel` (mostra
  "sem tarifa de referência" em vez de R$0,00 quando `total_esperado` é
  `null`, para não confundir "sem tarifa calculada" com "divergência zero")
- [x] `get_advisors` — sem achados novos
- [x] Verificação via SQL direto: 5 passagens sintéticas cobrindo `ok`,
  `valor_divergente`, `fora_poligono`, `sem_cadastro` e `nao_aplicavel`, 2
  praças, 2 veículos — os 3 agregados batendo exatamente com o cálculo
  manual (inclusive `total_esperado = null` e `divergencia_valor = 0` para
  `sem_cadastro`/`nao_aplicavel`, confirmando que essas causas não inflam
  nem escondem divergência real); cleanup confirmado (zero resíduo)
- [x] `typecheck`/`eslint`/`next build` limpos

**Notas de implementação:**
- Migration aplicada: `20260914143129_pedagio_fase17_divergencia_explicada`
  (mirror local em `supabase/migrations/`).
- Nenhuma migration em `validar_passagem`/`categoria_por_composicao` — só
  views de leitura novas sobre `vw_passagens_detalhado`, que já tinha todas
  as colunas necessárias desde a FASE 05/07/14.
- O card "Divergência total" no topo do Painel não mudou — a nova seção
  só adiciona a explicação abaixo dele.
- Top 5 por praça/veículo é filtrado para excluir linhas com divergência
  exatamente zero (`!== 0`), pra não desperdiçar um dos 5 slots com "sem
  divergência" quando há poucas praças/veículos com desvio real.

**Limitação conhecida:** não testado visualmente no navegador nem via REST
com usuário real (mesma limitação já registrada nas FASEs 15/16 — sem
`service_role key` nesta sessão). Cobertura ficou em SQL direto (views) +
build/typecheck/lint. Recomenda-se conferir `/dashboard` visualmente na
primeira vez que usar.

## Ajuste — reordenação do menu do header (2026-09-14)

**Pedido do usuário:** nova ordem dos links do header — Painel, Faturas,
Passagens, Viagens, Rastreamento, Importação, Cadastros (posição
confirmada com o usuário: antes de Usuários, já que ele não tinha
mencionado onde entraria), Usuários (admin-only, como já era).

- `app-header.tsx`: só reordenação dos `<Link>` já existentes, nenhuma
  rota nova nem lógica alterada.
- `typecheck`/`eslint` limpos (build completo não rodado de novo nesta
  mudança pontual, já tinha rodado limpo imediatamente antes na FASE 17).

## Ajuste — período inicial/final separados em Faturas (2026-09-14)

**Pedido do usuário:** a tela de faturas só mostrava um único campo
"Período" (`vw_fatura_resumo.periodo_inicio`/`periodo_fim` já eram o
menor/maior `data_hora` das passagens daquela fatura, calculados desde a
FASE 15 — só a apresentação juntava os dois numa string só, ex.: "01/09 –
05/09"). Ajuste é só de exibição, nenhuma migration.

- `FaturasTable` (lista `/faturas`): coluna única "Período" trocada por
  duas colunas, "Período inicial" e "Período final".
- `/faturas/[numero]` (detalhe): a linha de texto "Período: ..." abaixo do
  título virou dois `StatTile` novos ("Período inicial"/"Período final"),
  ao lado dos StatTiles financeiros já existentes (grid ampliado de
  `sm:grid-cols-4` para `lg:grid-cols-6` pra acomodar os dois novos sem
  quebrar layout em telas médias).
- `typecheck`/`eslint`/`next build` limpos. Verificado via SQL direto que
  `periodo_inicio`/`periodo_fim` de `vw_fatura_resumo` continuam sendo
  exatamente o min/max de `data_hora` das passagens da fatura.

## Próximo passo

Nenhum item pendente do plano atual. Próximos passos dependem do uso
real do sistema — trazer necessidades concretas conforme aparecerem.
Pendências conhecidas: conferir `/faturas` (FASE 15, incluindo o ajuste de
período inicial/final acima), `/cadastros/categorias`/`/cadastros/veiculos`
(FASE 16), a nova seção "Divergência" do Painel (FASE 17) com um usuário
autenticado real, e o modo escuro/claro (ajuste acima) visualmente no
navegador — nenhuma sessão recente teve `service_role key` nem ferramenta
de navegador disponível.
