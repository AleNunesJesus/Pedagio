import { aprovarSugestoesTarifa } from "./actions";

export type FonteSugestao = "fatura" | "osm" | "antt";

type ParaAprovar = { id: string; passagens_total: number };

// aprovar revalida as passagens da praça; blocos limitados por passagens
// (medido: ~3 ms/passagem, statement_timeout de 8 s)
const PASSAGENS_POR_BLOCO = 400;

function emBlocos<T extends ParaAprovar>(rows: T[]): T[][] {
  const blocos: T[][] = [];
  let atual: T[] = [];
  let soma = 0;
  for (const r of rows) {
    if (atual.length > 0 && soma + r.passagens_total > PASSAGENS_POR_BLOCO) {
      blocos.push(atual);
      atual = [];
      soma = 0;
    }
    atual.push(r);
    soma += r.passagens_total;
  }
  if (atual.length > 0) blocos.push(atual);
  return blocos;
}

// Aprova em blocos (uma chamada por bloco); para no primeiro erro e devolve
// quantas já tinham sido aprovadas. Usado na lista (seleção manual) e no
// gerar (gravação automática das confirmadas pela ANTT/OSM).
export async function aprovarEmBlocos(
  rows: ParaAprovar[],
  fonte: FonteSugestao,
  aoEnviarBloco: (qtd: number) => void,
): Promise<{ aprovadas: number; error?: string }> {
  let aprovadas = 0;
  for (const bloco of emBlocos(rows)) {
    const resultado = await aprovarSugestoesTarifa(
      bloco.map((r) => r.id),
      fonte,
    );
    if (resultado.error) return { aprovadas, error: resultado.error };
    aprovadas += resultado.aprovadas ?? 0;
    aoEnviarBloco(bloco.length);
  }
  return { aprovadas };
}
