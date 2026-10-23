// Monta a URL de /viagens-transporte mantendo os filtros atuais e trocando
// só o que vier em `troca` (undefined remove o parâmetro)
export function hrefViagens(
  searchParams: Record<string, string | undefined>,
  troca: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...searchParams, ...troca })) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/viagens-transporte?${qs}` : "/viagens-transporte";
}
