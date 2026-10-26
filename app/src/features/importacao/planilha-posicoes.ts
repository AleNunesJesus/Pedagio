import { chaveCabecalho } from "./planilha-passagens";

// Layout do CSV de posições de GPS: cabeçalho → coluna da staging_posicao_veiculo.
export const COLUNAS_PLANILHA_POSICOES = [
  { cabecalho: "placa", coluna: "placa" },
  { cabecalho: "latitude", coluna: "latitude_texto" },
  { cabecalho: "longitude", coluna: "longitude_texto" },
  { cabecalho: "data", coluna: "data_texto" },
  { cabecalho: "horario", coluna: "horario_texto" },
] as const;

// FASE 27 (medido pela API): bloco de 3.000 posições ~0,7–1,8 s no banco +
// ~0,5–0,8 s gravando a staging, ~360 KB por envio (limite do Server Action:
// 1 MB); revalidação de 200 passagens ~0,2–0,8 s (limite do banco: 8 s por
// chamada). Arquivo real: 4,7 milhões de linhas.
export const TAMANHO_BLOCO_POSICOES = 3000;
export const TAMANHO_BLOCO_REVALIDACAO = 200;

export type ColunaStagingPosicao = (typeof COLUNAS_PLANILHA_POSICOES)[number]["coluna"];

export function cabecalhosFaltandoPosicoes(cabecalhosDoArquivo: string[]): string[] {
  const encontrados = new Set(cabecalhosDoArquivo.map(chaveCabecalho));
  return COLUNAS_PLANILHA_POSICOES.filter((c) => !encontrados.has(chaveCabecalho(c.cabecalho))).map(
    (c) => c.cabecalho,
  );
}

function vazio(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const trimmed = valor.trim();
  return trimmed === "" ? null : trimmed;
}

// Linha lida com os cabeçalhos já passados por chaveCabecalho → linha da staging.
export function linhaPosicaoParaStaging(
  linha: Record<string, string>,
): Record<ColunaStagingPosicao, string | null> {
  const resultado = {} as Record<ColunaStagingPosicao, string | null>;
  for (const { cabecalho, coluna } of COLUNAS_PLANILHA_POSICOES) {
    resultado[coluna] = vazio(linha[chaveCabecalho(cabecalho)]);
  }
  return resultado;
}
