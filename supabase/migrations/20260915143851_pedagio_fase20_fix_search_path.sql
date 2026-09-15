-- Fix: get_advisors apontou search_path mutável nas 2 funções novas de
-- parâmetro isolado da FASE 20 (mesmo tipo de achado da FASE 03).
alter function pedagio.janela_busca_estacionamento() set search_path = '';
alter function pedagio.gap_continuidade_estacionamento() set search_path = '';
