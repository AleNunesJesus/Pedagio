-- Ajuste ao layout real do fornecedor descoberto no primeiro arquivo de
-- teste: condicao_texto vem como DB/CR (não "debito"/"credito" por
-- extenso), e tipo_uso_texto de contrato vem como "PLANO CONTRATADO"
-- (não "CONTRATO"). Usuário confirmou que é sempre assim nos arquivos
-- reais desse fornecedor.

create or replace function pedagio.normalizar_condicao(p_texto text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_norm text := translate(upper(trim(coalesce(p_texto, ''))), 'ÁÀÂÃÉÊÍÓÔÕÚÇ', 'AAAAEEIOOOUC');
begin
  if v_norm in ('DEBITO', 'DB') then
    return 'debito';
  elsif v_norm in ('CREDITO', 'CR') then
    return 'credito';
  else
    return null;
  end if;
end;
$$;

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
  else
    return null;
  end if;
end;
$$;
