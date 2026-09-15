-- Ajuste pedido pelo usuário: reduzir a janela de busca de estacionamento de
-- 30 dias pra 2 dias (nos dois sentidos, já simétrica desde o ajuste anterior)
-- — antecipando volume massivo de histórico de GPS, uma janela de 30 dias por
-- passagem ficaria cara (scan maior em posicao_veiculo a cada validação/
-- revalidação). 2 dias já é generoso pra permanência de estacionamento
-- (pernoite) sem escanear tanto histórico.
create or replace function pedagio.janela_busca_estacionamento()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '2 days'
$$;
