# Pedagio

Projeto de controle de pagamento de pedágios: concilia passagens de pedágio
(planilha) contra posição real dos veículos (GPS) via validação por
polígono, e contra tarifas vigentes por praça/categoria.

Status: desenho concluído, implementação segue [docs/ROADMAP.md](docs/ROADMAP.md)
fase a fase (mesma disciplina do projeto de tickets: uma FASE por vez, aval
explícito para avançar, commit só quando pedido). Nenhum schema aplicado
ainda no Supabase.

Stack decidida: Supabase (Postgres + PostGIS), schema próprio `pedagio` no
mesmo projeto do sistema de tickets (project_id `wduypqixkafimcndytiz`).
