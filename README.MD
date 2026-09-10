# Controle de Pagamento de Pedágios

Sistema para conciliar passagens de pedágio informadas por planilha contra a
posição real dos veículos (GPS), validando geograficamente se o veículo
efetivamente passou pela praça cobrada, e se o valor cobrado corresponde à
tarifa vigente naquela data.

## Objetivo

1. Importar planilhas de passagens de pedágio (id, veículo, praça, data/hora,
   valor, documento vinculado).
2. Validar cada passagem contra o histórico de posições GPS do veículo,
   usando geometria de polígono das praças (não apenas ponto único) — um
   veículo "está na praça" quando um ping cai dentro do polígono cadastrado
   daquela praça, dentro de uma janela de tempo tolerável.
3. Confrontar o valor cobrado com a tarifa vigente da praça/categoria do
   veículo na data da passagem.
4. Expor indicadores para auditoria financeira e operacional (divergências,
   gastos, tendências).

## Stack

- **Banco**: Supabase (Postgres + PostGIS) — mesmo projeto Supabase do
  sistema de tickets, porém em **schema próprio (`pedagio`)** para não
  misturar tabelas/objetos com o schema do projeto de tickets. PostGIS
  resolve nativamente `ST_Contains` / `ST_DWithin` para a validação por
  polígono.
- **Ingestão de GPS**: inicialmente carga em lote (arquivo), evoluindo depois
  para ingestão via API (o modelo de dados já é desenhado para suportar
  ambos os modos, com uma coluna de origem/fonte).
- **Ingestão de passagens**: sempre por planilha (CSV/XLSX), organizada em
  lotes de importação para rastreabilidade.

## Documentação

- [docs/modelo-dados.md](docs/modelo-dados.md) — entidades, relacionamentos e
  DDL (draft) das tabelas.
- [docs/fluxo-validacao.md](docs/fluxo-validacao.md) — algoritmo de
  cruzamento GPS × polígono × tarifa, incluindo regras de tolerância.
- [docs/indicadores.md](docs/indicadores.md) — indicadores e painéis
  propostos para análise.
- [docs/ROADMAP.md](docs/ROADMAP.md) — plano de fases da implementação
  (mesma disciplina do projeto de tickets: uma fase por vez).

## Decisões em aberto

- Multi-tenant (mais de uma empresa/frota usando o mesmo banco)? Afeta RLS.
- Tolerância de tempo/distância para considerar um ping "dentro" da praça.
- Frontend/dashboard: stack ainda não definida.
