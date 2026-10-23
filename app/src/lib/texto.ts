// busca simples sem diferenciar maiúsculas nem acentos ("sao" acha "São")
function normalizar(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function contem(termo: string | undefined, ...campos: (string | null | undefined)[]) {
  if (!termo?.trim()) return true;
  const t = normalizar(termo.trim());
  return campos.some((c) => c && normalizar(c).includes(t));
}
