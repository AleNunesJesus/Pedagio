# Modelo de Dados

Draft de schema para revisão — nada aplicado ainda no Supabase. Todas as
tabelas usam PostGIS (`geometry`/`geography`, SRID 4326).

## Schema

Todas as tabelas abaixo vivem no schema **`pedagio`** (não `public`), no
mesmo projeto Supabase do sistema de tickets, para isolar objetos/permissões
dos dois projetos. Nomes completos: `pedagio.praca_pedagio`,
`pedagio.tarifa_praca`, etc. (o prefixo é omitido nas tabelas abaixo por
brevidade).

Pontos de atenção decorrentes disso:
- A extensão PostGIS é global ao banco (schema `extensions`/`public`
  dependendo de como já foi instalada) — não precisa reinstalar, só
  referenciar os tipos normalmente.
- Por padrão o PostgREST do Supabase só expõe o schema `public` via API. Se
  o frontend for consumir `pedagio.*` diretamente via API (em vez de só
  RPC/Edge Functions), é preciso adicionar `pedagio` em
  Settings → API → "Exposed schemas".
- RLS deve ser habilitada por tabela dentro do schema `pedagio` do mesmo
  jeito que no `public` — isolamento de schema não substitui RLS.

## Visão geral das entidades

```mermaid
erDiagram
    PRACA_PEDAGIO ||--o{ TARIFA_PRACA : possui
    PRACA_PEDAGIO ||--o{ VALIDACAO_PASSAGEM : referencia
    CATEGORIA_VEICULO ||--o{ TARIFA_PRACA : possui
    CATEGORIA_VEICULO ||--o{ VEICULO : classifica
    VEICULO ||--o{ POSICAO_VEICULO : gera
    VEICULO ||--o{ PASSAGEM_PEDAGIO : realiza
    LOTE_IMPORTACAO ||--o{ PASSAGEM_PEDAGIO : origina
    PASSAGEM_PEDAGIO ||--|| VALIDACAO_PASSAGEM : resulta_em
    POSICAO_VEICULO ||--o{ VALIDACAO_PASSAGEM : evidencia
    VIAGEM ||--o{ PASSAGEM_PEDAGIO : agrupa
    EMBARCADOR ||--o{ PASSAGEM_PEDAGIO : credita
    VEICULO ||--o{ VIAGEM_TRANSPORTE : realiza
    EMBARCADOR ||--o{ VIAGEM_TRANSPORTE : credita
    LOTE_IMPORTACAO ||--o{ VIAGEM_TRANSPORTE : origina
    VEICULO |o..o{ VIAGEM_TRANSPORTE : engatada_em_como_carreta
    CATEGORIA_VEICULO ||--o{ VALIDACAO_PASSAGEM : usada_na_tarifa
```

## Tabelas

### `praca_pedagio`
Cadastro das praças e o polígono geográfico que delimita sua área de
cobrança/detecção.

| coluna | tipo | notas |
|---|---|---|
| id | uuid pk | |
| nome | text | |
| rodovia | text | |
| concessionaria | text | |
| km | numeric | opcional, referência |
| poligono | geometry(Polygon, 4326) null | área usada na validação; nulo só com `cadastro_pendente` (CHECK) |
| sentido | text | opcional (norte/sul, ida/volta) |
| ativo | boolean | default true |
| created_at | timestamptz | default now() |
| cadastro_pendente | boolean | default false — `true` quando criada automaticamente pela importação (FASE 22); vira `false` ao salvar pelo formulário (`atualizar_praca`) |
| criada_no_lote_id | fk lote_importacao null | lote que criou a praça automaticamente (`on delete set null`) |

Índice: `GIST(poligono)`, `criada_no_lote_id`.

FASE 22: a importação cria a praça que não encontra (nome + sentido da
planilha) via `obter_ou_criar_praca_importacao` (SECURITY DEFINER — insert
em `praca_pedagio` é admin-only no RLS, mas qualquer usuário autorizado
importa). Enquanto `poligono` é nulo, `validar_passagem` devolve
`sem_cadastro`.

### `categoria_veiculo`
Categorias de eixos — usadas tanto para tarifação por composição total
(ex.: `EIXO_6` = cavalo + carreta comum) quanto para os eixos próprios de
cada veículo/carreta isolado (ex.: `EIXO_3` = cavalo sozinho ou carreta
comum; `EIXO_4` = carreta vanderleia). `quantidade_eixos` (FASE 16) é o
número real, usado por `pedagio.categoria_por_composicao` para somar a
composição em vez de constantes fixas no código.

| coluna | tipo | notas |
|---|---|---|
| id | uuid pk | |
| codigo | text unique | ex: "EIXO_6" |
| descricao | text | |
| quantidade_eixos | integer not null | eixos representados por esta categoria (FASE 16) |

### `tarifa_praca`
Histórico do **valor por eixo** da praça, com vigência (FASE 24 — antes era
um valor por praça + categoria). A tarifa de cada passagem é valor por eixo ×
eixos cobrados (ver [fluxo-validacao.md](fluxo-validacao.md)).

| coluna | tipo | notas |
|---|---|---|
| id | uuid pk | |
| praca_id | fk praca_pedagio | |
| valor_eixo | numeric(10,2) | > 0 |
| vigencia_inicio | date | |
| vigencia_fim | date null | null = vigente atualmente |
| origem | text | `manual` \| `sugestao` (aprovada em `tarifa_eixo_sugestao`) |

Constraint: sem sobreposição de vigência para a mesma praça (via
`EXCLUDE USING gist` com `daterange`). Gravar/alterar/excluir revalida as
passagens da praça no período (trigger).

### `tarifa_eixo_osm` (FASE 24)
Instantâneo da tarifa por eixo (`charge` … `BRL/hgv/axle`) das cabines do
OpenStreetMap perto de cada praça completa, carregado por script (sem
chamada externa em tempo de execução; licença ODbL, crédito na tela).

| coluna | tipo | notas |
|---|---|---|
| praca_id | pk, fk praca_pedagio | `on delete cascade` |
| valor_eixo | numeric(10,2) | |
| osm_conferido_em | date null | `check_date` da cabine no OSM |
| osm_ids | text[] | cabines usadas (`node/…`, `way/…`) |
| carregado_em | timestamptz | |

### `tarifa_eixo_sugestao` (FASE 24)
Sugestão de valor por eixo por praça, calculada das faturas de um período
(`gerar_sugestoes_tarifa`) e comparada com o OSM. Se dividir o período num
dia de corte explica ≥ 5% a mais dos débitos (mínimo 5), a praça recebe duas
sugestões, uma por trecho (reajuste no meio do mês — ex.: Litoral Sul 5,70
até 13/09 e 5,90 a partir de 14/09). Aprovar (`aprovar_sugestoes_tarifa`,
fonte fatura ou OSM) grava `tarifa_praca` a partir de `periodo_inicio`,
fechando a tarifa aberta anterior e terminando na véspera de uma tarifa
posterior já gravada (a ordem de aprovação dos trechos não importa).

| coluna | tipo | notas |
|---|---|---|
| id | uuid pk | |
| praca_id | fk praca_pedagio | `on delete cascade`; no máximo 1 `pendente` por praça + `periodo_inicio` (índice único parcial) |
| periodo_inicio / periodo_fim | date | dias (horário local) dos débitos usados |
| valor_eixo_fatura | numeric(10,2) | candidato que explica mais débitos |
| passagens_total / passagens_explicadas | int | débitos do período / explicados com eixos ≤ composição |
| valor_eixo_osm / osm_conferido_em | null | cópia de `tarifa_eixo_osm` no momento da geração |
| fontes_concordam | boolean | \|fatura − OSM\| ≤ 0,01 |
| status | text | `pendente` \| `aprovada` \| `descartada` |
| decidido_por / decidido_em | | e-mail do JWT e momento da decisão |
| tarifa_praca_id | fk tarifa_praca null | tarifa gravada na aprovação; `on delete set null` |

### `veiculo`
Cadastro único de cavalo mecânico e carreta (FASE 16 — antes eram tabelas
separadas). `categoria_veiculo_id` significa os **eixos próprios** do
veículo/carreta (ex.: cavalo → `EIXO_3`, carreta vanderleia → `EIXO_4`).
`categoria_fallback_id` só se aplica a `tipo = 'cavalo'`: é a categoria de
tarifa usada quando a composição real (cavalo + carreta(s), via
`viagem_transporte`) não pôde ser determinada — antes da FASE 16 essa era
a única função de `categoria_veiculo_id`.

| coluna | tipo | notas |
|---|---|---|
| id | uuid pk | |
| placa | text unique | |
| tipo | text | `cavalo` \| `carreta` |
| categoria_veiculo_id | fk categoria_veiculo | eixos próprios do veículo/carreta |
| categoria_fallback_id | fk categoria_veiculo null | só para `tipo = 'cavalo'`; tarifa quando a composição não é conhecida |
| frota / empresa | text | opcional, se multi-frota |
| ativo | boolean | |

Só `tipo = 'cavalo'` deve ser resolvido como `veiculo_id` em
`passagem_pedagio`/`posicao_veiculo`/`viagem_transporte` (carretas nunca
passam pedágio nem carregam rastreador próprio) — os matches por placa na
importação filtram `tipo = 'cavalo'`.

### `posicao_veiculo`
Pings de GPS. Tabela de maior volume — particionar por mês (`data_hora`)
quando o volume justificar.

| coluna | tipo | notas |
|---|---|---|
| id | bigserial pk | |
| veiculo_id | fk veiculo | |
| geom | geometry(Point, 4326) | |
| data_hora | timestamptz | |
| fonte | text | `carga_arquivo` \| `api` |
| lote_importacao_id | fk lote_importacao null | quando vier de arquivo |
| created_at | timestamptz | default now() |

Índices: `GIST(geom)`, `(veiculo_id, data_hora)`.

### `lote_importacao`
Rastreabilidade de cada carga de planilha (passagens ou posições).

| coluna | tipo | notas |
|---|---|---|
| id | uuid pk | |
| tipo | text | `passagens` \| `posicoes_gps` |
| arquivo_nome | text | |
| usuario | text | quem importou |
| total_linhas | int | |
| total_erros | int | |
| created_at | timestamptz | |

### `passagem_pedagio`
Uma linha da planilha de passagens importada (formato real do fornecedor,
FASE 07).

| coluna | tipo | notas |
|---|---|---|
| id | uuid pk | |
| numero_fatura | text | número da fatura vindo da planilha, para rastreio |
| veiculo_id | fk veiculo null | null se placa não reconhecida |
| placa_informada | text | valor bruto da planilha (auditoria) |
| tipo_veiculo_informado | text | texto livre da planilha, só informativo (tarifa usa a categoria já cadastrada do veículo) |
| praca_id | fk praca_pedagio null | desde a FASE 22 a importação cria a praça que não encontra, então só fica null em linhas antigas ou sem `praca_nome` |
| praca_informada | text | valor bruto da planilha |
| sentido_informado | text | usado junto com praca_informada para casar com o cadastro |
| tipo_uso | text | `passagem` \| `contrato` — contrato nunca passa pela validação geo/tarifária |
| condicao | text | `debito` \| `credito` — sinal de valor_cobrado precisa bater com esta coluna |
| data_hora | timestamptz | montada a partir de data + horário da planilha |
| valor_cobrado | numeric(10,2) | negativo quando condicao = credito |
| viagem_informada | text | valor bruto da planilha (auditoria), opcional |
| viagem_id | fk viagem null | auto-cadastrado na importação (FASE 10) quando `viagem_informada` não é vazio |
| embarcador_informada | text | valor bruto da planilha (auditoria), opcional |
| embarcador_id | fk embarcador null | auto-cadastrado na importação (FASE 10) quando `embarcador_informada` não é vazio |
| lote_importacao_id | fk lote_importacao | |
| status_validacao | text | `pendente` (default) \| ... \| `nao_aplicavel` (linhas tipo_uso = contrato) |
| created_at | timestamptz | |

Constraint: `unique (placa_informada, data_hora, condicao, valor_cobrado)`
— evita duplicar a mesma linha ao reimportar um arquivo (débito e crédito
pareados da mesma passagem continuam distintos porque diferem em
`condicao`/`valor_cobrado`).

### `viagem` (FASE 10)
Auto-cadastrada na importação a partir de `viagem_informada` — sem tela
de cadastro manual, só existe pra dar FK e permitir filtrar/agrupar
passagens por viagem.

| coluna | tipo | notas |
|---|---|---|
| id | uuid pk | |
| numero | text unique | mesmo valor de `viagem_informada`, sem duplicar |
| criado_em | timestamptz | default now() |

### `embarcador` (FASE 10)
Auto-cadastrado na importação a partir de `embarcador_informada`. CNPJ é
o único campo editável manualmente (tela `/cadastros/embarcadores`,
admin-only) — não vem da planilha.

| coluna | tipo | notas |
|---|---|---|
| id | uuid pk | |
| nome | text unique | mesmo valor de `embarcador_informada` |
| cnpj | text null | preenchido manualmente, opcional |
| criado_em | timestamptz | default now() |

### `validacao_passagem`
Resultado do cruzamento geoespacial + tarifário para cada passagem.

| coluna | tipo | notas |
|---|---|---|
| id | uuid pk | |
| passagem_id | fk passagem_pedagio unique | 1:1, `on delete cascade` — some junto se a passagem for excluída |
| posicao_veiculo_id | fk posicao_veiculo null | ping usado como evidência; `on delete set null` — some só a evidência, a passagem é revalidada em seguida |
| dentro_poligono | boolean | |
| distancia_metros | numeric | distância do ping ao centróide/borda, se fora |
| diferenca_segundos | int | |ping.data_hora - passagem.data_hora| |
| valor_esperado | numeric(10,2) | conferência por eixo (FASE 24): igual ao cobrado quando completo/eixos suspensos; tarifa por eixo × eixos da composição (com −5% se veio com TAG) quando eixos a maior/não múltiplo; null sem tarifa vigente, sem categoria ou em crédito |
| divergencia_valor | numeric(10,2) | valor_cobrado - valor_esperado |
| resultado | text | `ok` \| `sem_dados_gps` \| `fora_poligono` \| `valor_divergente` \| `local_e_valor_divergentes` |
| validado_em | timestamptz | |
| categoria_veiculo_id | fk categoria_veiculo null | categoria usada pra achar `valor_esperado` — nem sempre é `veiculo.categoria_veiculo_id` (ver `origem_categoria`) |
| origem_categoria | text | `composicao_viagem` (achou a viagem de transporte + carreta(s) cadastrada(s)) \| `cadastro_veiculo` (fallback: categoria fixa do veículo) |
| viagem_transporte_id | fk viagem_transporte null | vínculo por placa + janela saída/chegada (FASE 21); null se `sem_vinculo`/`ambiguo` |
| vinculo_viagem_status | text | `vinculado` (1 candidata) \| `ambiguo` (2+ candidatas — não escolhe sozinho) \| `sem_vinculo` (0 candidatas) — FASE 21 |
| viagem_transporte_candidatas | int | quantas `viagem_transporte` da mesma placa cobrem o horário da passagem |
| numero_viagem_bate | boolean null | `viagem_informada` (fatura) == `viagem_transporte.numero_transporte`, só quando `vinculado`; null se ambíguo/sem vínculo/sem número na fatura — informativo, não é divergência (numerações de sistemas diferentes) |
| eixos_composicao | int null | eixos da categoria usada (FASE 24); preenchido só quando houve conferência por eixo |
| eixos_cobrados | int null | k inteiro com valor ≈ tarifa por eixo × k (`eixos_cobrados()`); null se nenhum k de 1 a 12 explica |
| desconto_tag | boolean null | o valor veio com 5% de desconto de TAG |
| motivo_valor | text null | `completo` \| `eixos_suspensos` \| `eixos_a_maior` \| `nao_multiplo`; null = sem conferência (sem tarifa, sem categoria ou crédito) |

Ver [fluxo-validacao.md](fluxo-validacao.md) para o algoritmo que popula esta
tabela, incluindo como `categoria_veiculo_id`/`origem_categoria` são
resolvidos (`pedagio.categoria_por_composicao`) e como o vínculo com
`viagem_transporte` é resolvido (FASE 21).

### Carretas (removido como tabela própria na FASE 16)
Até a FASE 15, carretas viviam numa tabela `pedagio.carreta` separada
(placa/código → tipo `comum`/`vanderleia`). A FASE 16 uniu esse cadastro
em `veiculo` (`tipo = 'carreta'`, eixos vindo de `categoria_veiculo` em
vez do campo solto `tipo`) — ver seção `veiculo` acima.

Inserir, alterar ou excluir uma linha `tipo = 'carreta'` em `veiculo`
revalida automaticamente (trigger) todas as passagens de viagens de
transporte que usam aquela placa como `carreta1`/`carreta2` — a
quantidade de eixos (e portanto a tarifa esperada) pode mudar.

### `estacionamento` (FASE 20)
Cadastro de locais de pernoite/período (pátio, estacionamento) com polígono
geográfico — mesmo modelo de `praca_pedagio`, sem o conceito de "sentido".

| coluna | tipo | notas |
|---|---|---|
| id | uuid pk | |
| nome | text | |
| poligono | geometry(Polygon, 4326) null | área usada na detecção de permanência; nulo só com `cadastro_pendente` (CHECK) |
| ativo | boolean | default true |
| created_at | timestamptz | default now() |
| cadastro_pendente | boolean | default false — mesmo significado de `praca_pedagio` (FASE 22) |
| criada_no_lote_id | fk lote_importacao null | idem |

Índice: `GIST(poligono)`, `criada_no_lote_id`.

### `tarifa_estacionamento` (FASE 20)
Histórico de valores de diária por estacionamento, com vigência — mesmo
padrão de `tarifa_praca` (nunca `UPDATE` do valor, sempre nova vigência).

| coluna | tipo | notas |
|---|---|---|
| id | uuid pk | |
| estacionamento_id | fk estacionamento | |
| valor_diaria | numeric(10,2) | |
| vigencia_inicio | date | |
| vigencia_fim | date null | null = vigente atualmente |

Constraint: sem sobreposição de vigência para o mesmo estacionamento (via
`EXCLUDE USING gist` com `daterange`).

### `validacao_estacionamento` (FASE 20)
Resultado da validação de permanência para cada passagem `tipo_uso =
'estacionamento'`. Tabela própria (não reaproveita `validacao_passagem`):
os campos são conceitualmente diferentes — permanência detectada num
período, não um ponto único no tempo casado a uma janela curta.

| coluna | tipo | notas |
|---|---|---|
| id | uuid pk | |
| passagem_id | fk passagem_pedagio unique | 1:1, `on delete cascade` |
| entrada_detectada | timestamptz null | início da "corrida" de pings dentro do polígono mais próxima/relevante à `data_hora` da linha |
| saida_detectada | timestamptz null | fim dessa corrida |
| diarias_detectadas | integer null | `ceil(duração / 24h)`, mínimo 1 |
| tarifa_diaria_aplicada | numeric(10,2) null | tarifa vigente usada no cálculo |
| valor_esperado | numeric(10,2) null | `diarias_detectadas × tarifa_diaria_aplicada`; null se não há tarifa vigente cadastrada (mesma simplificação de `tarifa_praca`, FASE 03) |
| divergencia_valor | numeric(10,2) null | `valor_cobrado - valor_esperado` |
| resultado | text | `ok` \| `sem_dados_gps` \| `valor_divergente` — reaproveita valores já existentes do domínio de `status_validacao` |
| validado_em | timestamptz | |

Ver [fluxo-validacao.md](fluxo-validacao.md) para o algoritmo de detecção de
permanência ("gaps and islands" sobre os pings dentro do polígono).

`passagem_pedagio` ganhou `estacionamento_id` (FK nullable) — resolvido na
importação junto com `veiculo_id`/`praca_id`, casando `praca_nome` (mesma
coluna reaproveitada, sem usar `sentido`) contra `estacionamento.nome`
quando `tipo_uso = 'estacionamento'`. `tipo_uso` passou a aceitar
`'estacionamento'` além de `'passagem'`/`'contrato'`.

### `viagem_transporte` (FASE 13)
Uma linha do documento fiscal/transporte importado (planilha do sistema
de logística, formato real do fornecedor). Entidade independente de
`viagem` (FASE 10) — numeração e origem de dado diferentes.

| coluna | tipo | notas |
|---|---|---|
| id | uuid pk | |
| numero_transporte | text unique | número do documento fiscal/transporte |
| veiculo_id | fk veiculo null | null se `placa_informada` não reconhecida |
| placa_informada | text | valor bruto da planilha (auditoria) |
| cidade_origem / uf_origem | text | |
| cidade_destino / uf_destino | text | |
| data_hora_saida | timestamptz | |
| data_hora_chegada | timestamptz | |
| carreta1 | text null | placa/código da carreta; preenchido indica 6/7 eixos |
| carreta2 | text null | preenchido junto com `carreta1` indica 9 eixos |
| tipo_viagem | text | `carregado` \| `vazio` |
| embarcador_id | fk embarcador null | descoberto cruzando placa + janela saída/chegada contra `passagem_pedagio.embarcador_informada` — não vem na planilha |
| lote_importacao_id | fk lote_importacao | |
| created_at | timestamptz | |
