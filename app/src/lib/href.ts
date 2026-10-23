// Monta a URL de uma lista mantendo os filtros atuais (searchParams) e
// trocando só o que vier em `troca` (undefined remove o parâmetro)
export function hrefCom(
  base: string,
  searchParams: Record<string, string | undefined>,
  troca: Record<string, string | undefined> = {},
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...searchParams, ...troca })) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
