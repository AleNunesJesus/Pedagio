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

// Passagens vão ao servidor em blocos (FASE 23): limite de 1 MB por Server
// Action e statement_timeout de 8 s do papel authenticated. 500 linhas ≈ 100 KB
// e ~3 s de banco no pior bloco medido com a fatura real de 34.536 linhas.
export const TAMANHO_BLOCO_PASSAGENS = 500;

export type ColunaStagingPassagem = (typeof COLUNAS_PLANILHA_PASSAGENS)[number]["coluna"];

// "Número da Fatura" e "NUMERO DA FATURA " viram a mesma chave: ignora
// acento, maiúsculas, espaços e pontuação ("Valor(R$)" → "valorr").
export function chaveCabecalho(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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

// Linha 100% idêntica que aparece de novo no mesmo arquivo é outra ocorrência
// (ex.: dois créditos de vale-pedágio iguais na mesma viagem): 1ª, 2ª… O
// número entra na trava de duplicidade do banco, então reimportar o mesmo
// arquivo continua não duplicando. Precisa rodar sobre o arquivo inteiro,
// antes de dividir em blocos.
export function numerarOcorrencias<T extends Record<ColunaStagingPassagem, string | null>>(
  linhas: T[],
): (T & { ocorrencia: number })[] {
  const vistas = new Map<string, number>();
  return linhas.map((linha) => {
    const chave = JSON.stringify(COLUNAS_PLANILHA_PASSAGENS.map((c) => linha[c.coluna]));
    const ocorrencia = (vistas.get(chave) ?? 0) + 1;
    vistas.set(chave, ocorrencia);
    return { ...linha, ocorrencia };
  });
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
