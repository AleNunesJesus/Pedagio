import type { FaturaResumo } from "./queries";

// fica fora de queries.ts: é usado pela tabela (client) e queries.ts puxa next/headers
export function qtdAtencao(f: FaturaResumo): number {
  return (f.qtd_total ?? 0) - (f.qtd_ok ?? 0) - (f.qtd_nao_aplicavel ?? 0);
}
