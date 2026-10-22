import { chaveCabecalho } from "./planilha-passagens";

// Layout do CSV de viagens (documento fiscal): cabeçalho → coluna da
// staging_viagem_transporte.
export const COLUNAS_PLANILHA_VIAGENS = [
  { cabecalho: "placa", coluna: "placa" },
  { cabecalho: "numero_transporte", coluna: "numero_transporte" },
  { cabecalho: "cidade_origem", coluna: "cidade_origem" },
  { cabecalho: "uf_origem", coluna: "uf_origem" },
  { cabecalho: "cidade_destino", coluna: "cidade_destino" },
  { cabecalho: "uf_destino", coluna: "uf_destino" },
  { cabecalho: "data_hora_saida", coluna: "data_hora_saida_texto" },
  { cabecalho: "data_hora_chegada", coluna: "data_hora_chegada_texto" },
  { cabecalho: "carreta1", coluna: "carreta1" },
  { cabecalho: "carreta2", coluna: "carreta2" },
  { cabecalho: "tipo_viagem", coluna: "tipo_viagem_texto" },
] as const;

// Viagens vão em blocos menores que passagens: cada viagem revalida as
// passagens do seu período. Pior bloco medido: ~0,9 s com 4.981 viagens
// reais sobre 34.536 passagens (limite do banco: 8 s por chamada).
export const TAMANHO_BLOCO_VIAGENS = 200;

export type ColunaStagingViagem = (typeof COLUNAS_PLANILHA_VIAGENS)[number]["coluna"];

export function cabecalhosFaltandoViagens(cabecalhosDoArquivo: string[]): string[] {
  const encontrados = new Set(cabecalhosDoArquivo.map(chaveCabecalho));
  return COLUNAS_PLANILHA_VIAGENS.filter((c) => !encontrados.has(chaveCabecalho(c.cabecalho))).map(
    (c) => c.cabecalho,
  );
}

function vazio(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const trimmed = valor.trim();
  return trimmed === "" ? null : trimmed;
}

// Linha lida com os cabeçalhos já passados por chaveCabecalho → linha da staging.
export function linhaViagemParaStaging(
  linha: Record<string, string>,
): Record<ColunaStagingViagem, string | null> {
  const resultado = {} as Record<ColunaStagingViagem, string | null>;
  for (const { cabecalho, coluna } of COLUNAS_PLANILHA_VIAGENS) {
    resultado[coluna] = vazio(linha[chaveCabecalho(cabecalho)]);
  }
  return resultado;
}
