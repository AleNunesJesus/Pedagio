-- Ajuste pós-FASE 20: primeiro arquivo real de estacionamento trouxe
-- tipo_uso_texto = 'ESTACINOAMENTO' (letras trocadas), não 'ESTACIONAMENTO'
-- como assumido no desenho inicial (rótulo provisório, sem arquivo real
-- disponível até então) — mesmo tipo de ajuste já feito na FASE 07 para
-- DB/CR/PLANO CONTRATADO.
create or replace function pedagio.normalizar_tipo_uso(p_texto text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_norm text := translate(upper(trim(coalesce(p_texto, ''))), 'ÁÀÂÃÉÊÍÓÔÕÚÇ', 'AAAAEEIOOOUC');
begin
  if v_norm in ('PASSAGEM', 'PASSAGENS') then
    return 'passagem';
  elsif v_norm in ('CONTRATO', 'PLANO CONTRATADO') then
    return 'contrato';
  elsif v_norm in ('ESTACIONAMENTO', 'ESTACINOAMENTO') then
    return 'estacionamento';
  else
    return null;
  end if;
end;
$$;
