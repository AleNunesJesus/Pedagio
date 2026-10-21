// Layout da planilha de passagens do fornecedor: cabeçalho como vem no
// arquivo (na ordem em que vem) → coluna da staging_passagem_pedagio.
export const COLUNAS_PLANILHA_PASSAGENS = [
  { cabecalho: "Número da Fatura", coluna: "numero_fatura" },
  { cabecalho: "Data", coluna: "data_texto" },
  { cabecalho: "Horário", coluna: "horario_texto" },
  { cabecalho: "Placa Veículo", coluna: "placa" },
  { cabecalho: "Tipo do veículo", coluna: "tipo_veiculo" },
  { cabecalho: "Descrição", coluna: "praca_nome" },
  { cabecalho: "Tipo de uso", coluna: "tipo_uso_texto" },
  { cabecalho: "Valor(R$)", coluna: "valor_texto" },
  { cabecalho: "Débito/Crédito", coluna: "condicao_texto" },
  { cabecalho: "Viagem de Vale Pedágio", coluna: "viagem" },
  { cabecalho: "Embarcador", coluna: "embarcador" },
  { cabecalho: "Sentido da Praça", coluna: "sentido" },
] as const;

export type ColunaStagingPassagem = (typeof COLUNAS_PLANILHA_PASSAGENS)[number]["coluna"];

// "Número da Fatura" e "NUMERO DA FATURA " viram a mesma chave: ignora
// acento, maiúsculas, espaços e pontuação ("Valor(R$)" → "valorr").
export function chaveCabecalho(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Excel em português salva "CSV" em Windows-1252; sem isso os acentos dos
// cabeçalhos e dos nomes de praça chegam corrompidos. UTF-8 válido (com ou
// sem BOM) é lido como UTF-8; qualquer outra coisa, como Windows-1252.
export function decodificarArquivo(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

// Cabeçalhos do layout que não aparecem no arquivo (pelo nome de exibição).
export function cabecalhosFaltando(cabecalhosDoArquivo: string[]): string[] {
  const encontrados = new Set(cabecalhosDoArquivo.map(chaveCabecalho));
  return COLUNAS_PLANILHA_PASSAGENS.filter((c) => !encontrados.has(chaveCabecalho(c.cabecalho))).map(
    (c) => c.cabecalho,
  );
}

function vazio(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const trimmed = valor.trim();
  return trimmed === "" ? null : trimmed;
}

// Linha lida com os cabeçalhos já passados por chaveCabecalho → linha da staging.
export function linhaParaStaging(
  linha: Record<string, string>,
): Record<ColunaStagingPassagem, string | null> {
  const resultado = {} as Record<ColunaStagingPassagem, string | null>;
  for (const { cabecalho, coluna } of COLUNAS_PLANILHA_PASSAGENS) {
    resultado[coluna] = vazio(linha[chaveCabecalho(cabecalho)]);
  }
  return resultado;
}
