-- Planilha de passagens passou a trazer o valor como "R$ 10,00" / "R$ -10,00".
-- parse_valor_brl agora aceita o símbolo R$ (com ou sem espaço, inclusive o
-- espaço não separável que o Excel coloca), sinal antes ou depois do R$
-- ("-R$ 10,00" / "R$ -10,00") e negativo contábil entre parênteses
-- ("(R$ 10,00)"). Formatos que já funcionavam ("10,00", "-1.234,56") não
-- mudam. O sinal continua sendo normalizado pela condição na importação
-- (débito = positivo, crédito = negativo).
create or replace function pedagio.parse_valor_brl(p_texto text)
 returns numeric
 language plpgsql
 immutable
 set search_path to ''
as $function$
declare
  v_limpo text;
  v_negativo boolean := false;
begin
  -- espaços comuns, não separáveis (U+00A0) e estreitos (U+202F)
  v_limpo := regexp_replace(coalesce(p_texto, ''), '[[:space:]' || chr(160) || chr(8239) || ']', '', 'g');
  v_limpo := replace(v_limpo, 'R$', '');

  if v_limpo ~ '^\(.*\)$' then
    v_negativo := true;
    v_limpo := substr(v_limpo, 2, length(v_limpo) - 2);
  end if;

  -- sem espaços e sem R$, "-R$ 10,00" e "R$ -10,00" viram "-10,00"
  if left(v_limpo, 1) = '-' then
    v_negativo := not v_negativo;
    v_limpo := substr(v_limpo, 2);
  end if;

  -- só dígitos com separadores; qualquer outra coisa é valor inválido
  if v_limpo !~ '^[0-9][0-9.,]*$' then
    return null;
  end if;

  if position(',' in v_limpo) > 0 then
    -- formato brasileiro: ponto = separador de milhar, vírgula = decimal
    v_limpo := replace(replace(v_limpo, '.', ''), ',', '.');
  end if;

  return case when v_negativo then -(v_limpo::numeric) else v_limpo::numeric end;
exception when others then
  return null;
end;
$function$;
