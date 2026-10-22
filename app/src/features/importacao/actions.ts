"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { COLUNAS_PLANILHA_PASSAGENS, type ColunaStagingPassagem } from "./planilha-passagens";
import { COLUNAS_PLANILHA_VIAGENS, type ColunaStagingViagem } from "./planilha-viagens";

export type ImportacaoState = {
  error?: string;
  lote?: {
    id: string;
    total_linhas: number | null;
    total_erros: number | null;
  };
  // erros do lote agrupados pelo motivo (FASE 23)
  errosPorMotivo?: Record<string, number>;
  // praças/estacionamentos criados automaticamente por este lote (FASE 22);
  // a lista vem limitada, o total vem em totalCadastrosCriados
  cadastrosCriados?: { tipo: "praca" | "estacionamento"; nome: string; sentido: string | null }[];
  totalCadastrosCriados?: { pracas: number; estacionamentos: number };
};

// importação de posições de GPS (passagens e viagens vão em blocos, sem
// limite de linhas — FASE 23)
const LIMITE_LINHAS = 5000;

// folga sobre TAMANHO_BLOCO_PASSAGENS / TAMANHO_BLOCO_VIAGENS
const LIMITE_BLOCO = 1000;
const CADASTROS_CRIADOS_LISTADOS = 15;

export type LinhaStagingPassagem = Record<ColunaStagingPassagem, string | null> & { ocorrencia: number };
export type LinhaStagingViagem = Record<ColunaStagingViagem, string | null>;

function vazio(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const trimmed = valor.trim();
  return trimmed === "" ? null : trimmed;
}

function linhaValida(linha: unknown): linha is LinhaStagingPassagem {
  if (typeof linha !== "object" || linha === null) return false;
  const l = linha as Record<string, unknown>;
  return (
    COLUNAS_PLANILHA_PASSAGENS.every(({ coluna }) => l[coluna] === null || typeof l[coluna] === "string") &&
    Number.isInteger(l.ocorrencia) &&
    (l.ocorrencia as number) >= 1
  );
}

function linhaViagemValida(linha: unknown): linha is LinhaStagingViagem {
  if (typeof linha !== "object" || linha === null) return false;
  const l = linha as Record<string, unknown>;
  return COLUNAS_PLANILHA_VIAGENS.every(({ coluna }) => l[coluna] === null || typeof l[coluna] === "string");
}

async function criarLote(
  tipo: "passagens" | "viagens_transporte",
  arquivoNome: string,
): Promise<{ loteId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const usuario = (claims?.claims?.email as string | undefined) ?? null;

  const { data, error } = await supabase
    .from("lote_importacao")
    .insert({ tipo, arquivo_nome: arquivoNome.slice(0, 255), usuario, total_linhas: 0, total_erros: 0 })
    .select("id")
    .single();
  if (error) return { error: `Erro ao criar o lote: ${error.message}` };
  return { loteId: data.id };
}

// Depois de uma carga grande o planejador ainda não "sabe" do volume novo e
// ignora índices até o autovacuum rodar — a próxima importação (ex.: viagens
// logo após as passagens do mês) estourava o tempo. Falha aqui não invalida
// a importação, só deixa a próxima mais lenta.
async function atualizarEstatisticas(supabase: Awaited<ReturnType<typeof createClient>>) {
  await supabase.rpc("atualizar_estatisticas_importacao");
}

export async function iniciarImportacaoPassagens(
  arquivoNome: string,
): Promise<{ loteId?: string; error?: string }> {
  return criarLote("passagens", arquivoNome);
}

export async function importarBlocoPassagens(
  loteId: string,
  linhas: LinhaStagingPassagem[],
): Promise<{ processadas?: number; erros?: number; error?: string }> {
  if (!Array.isArray(linhas) || linhas.length === 0 || linhas.length > LIMITE_BLOCO) {
    return { error: `Bloco inválido (1 a ${LIMITE_BLOCO} linhas).` };
  }
  if (!linhas.every(linhaValida)) return { error: "Bloco com linha em formato inesperado." };

  const supabase = await createClient();

  const { error: insertError } = await supabase
    .from("staging_passagem_pedagio")
    .insert(linhas.map((l) => ({ ...l, lote_id: loteId })));
  if (insertError) return { error: `Erro ao gravar na staging: ${insertError.message}` };

  const { data, error } = await supabase.rpc("processar_bloco_passagens", {
    p_lote_id: loteId,
    p_limite: linhas.length,
  });
  if (error) return { error: `Erro ao processar o bloco: ${error.message}` };

  const resultado = data as { processadas: number; erros: number };
  return { processadas: resultado.processadas, erros: resultado.erros };
}

export async function finalizarImportacaoPassagens(loteId: string): Promise<ImportacaoState> {
  const supabase = await createClient();

  await atualizarEstatisticas(supabase);
  // viagens importadas antes destas passagens ficaram sem embarcador
  await supabase.rpc("completar_embarcador_viagens");

  const [{ data: lote, error }, pracas, estacionamentos] = await Promise.all([
    supabase
      .from("lote_importacao")
      .select("id, total_linhas, total_erros, erros_por_motivo")
      .eq("id", loteId)
      .single(),
    supabase
      .from("praca_pedagio")
      .select("nome, sentido", { count: "exact" })
      .eq("criada_no_lote_id", loteId)
      .order("nome")
      .limit(CADASTROS_CRIADOS_LISTADOS),
    supabase
      .from("estacionamento")
      .select("nome", { count: "exact" })
      .eq("criada_no_lote_id", loteId)
      .order("nome")
      .limit(CADASTROS_CRIADOS_LISTADOS),
  ]);
  if (error) return { error: `Erro ao ler o resultado do lote: ${error.message}` };

  revalidatePath("/importacao");
  revalidatePath("/cadastros/pracas");
  revalidatePath("/cadastros/estacionamentos");
  revalidatePath("/viagens-transporte");
  revalidatePath("/dashboard");
  return {
    lote: { id: lote.id, total_linhas: lote.total_linhas, total_erros: lote.total_erros },
    errosPorMotivo: (lote.erros_por_motivo ?? {}) as Record<string, number>,
    cadastrosCriados: [
      ...(pracas.data ?? []).map((p) => ({ tipo: "praca" as const, nome: p.nome, sentido: p.sentido })),
      ...(estacionamentos.data ?? []).map((e) => ({ tipo: "estacionamento" as const, nome: e.nome, sentido: null })),
    ],
    totalCadastrosCriados: { pracas: pracas.count ?? 0, estacionamentos: estacionamentos.count ?? 0 },
  };
}

export async function iniciarImportacaoViagens(
  arquivoNome: string,
): Promise<{ loteId?: string; error?: string }> {
  return criarLote("viagens_transporte", arquivoNome);
}

export async function importarBlocoViagens(
  loteId: string,
  linhas: LinhaStagingViagem[],
): Promise<{ processadas?: number; erros?: number; error?: string }> {
  if (!Array.isArray(linhas) || linhas.length === 0 || linhas.length > LIMITE_BLOCO) {
    return { error: `Bloco inválido (1 a ${LIMITE_BLOCO} linhas).` };
  }
  if (!linhas.every(linhaViagemValida)) return { error: "Bloco com linha em formato inesperado." };

  const supabase = await createClient();

  const { error: insertError } = await supabase
    .from("staging_viagem_transporte")
    .insert(linhas.map((l) => ({ ...l, lote_id: loteId })));
  if (insertError) return { error: `Erro ao gravar na staging: ${insertError.message}` };

  const { data, error } = await supabase.rpc("processar_bloco_viagens_transporte", {
    p_lote_id: loteId,
    p_limite: linhas.length,
  });
  if (error) return { error: `Erro ao processar o bloco: ${error.message}` };

  const resultado = data as { processadas: number; erros: number };
  return { processadas: resultado.processadas, erros: resultado.erros };
}

export async function finalizarImportacaoViagens(loteId: string): Promise<ImportacaoState> {
  const supabase = await createClient();

  await atualizarEstatisticas(supabase);

  const { data: lote, error } = await supabase
    .from("lote_importacao")
    .select("id, total_linhas, total_erros, erros_por_motivo")
    .eq("id", loteId)
    .single();
  if (error) return { error: `Erro ao ler o resultado do lote: ${error.message}` };

  revalidatePath("/importacao");
  revalidatePath("/viagens-transporte");
  revalidatePath("/dashboard");
  return {
    lote: { id: lote.id, total_linhas: lote.total_linhas, total_erros: lote.total_erros },
    errosPorMotivo: (lote.erros_por_motivo ?? {}) as Record<string, number>,
  };
}

export async function excluirLotes(ids: string[]): Promise<{ error?: string }> {
  const supabase = await createClient();

  for (const id of ids) {
    const { error } = await supabase.rpc("excluir_lote_importacao", { p_lote_id: id });
    if (error) return { error: error.message };
  }

  revalidatePath("/importacao");
  revalidatePath("/passagens");
  revalidatePath("/rastreamento");
  revalidatePath("/viagens-transporte");
  return {};
}

const COLUNAS_ESPERADAS_POSICOES = ["placa", "latitude", "longitude", "data", "horario"] as const;

export async function importarPosicoes(
  _prevState: ImportacaoState,
  formData: FormData,
): Promise<ImportacaoState> {
  const arquivo = formData.get("arquivo");

  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { error: "Selecione um arquivo CSV." };
  }

  const texto = await arquivo.text();
  const resultado = Papa.parse<Record<string, string>>(texto, {
    header: true,
    skipEmptyLines: true,
  });

  if (resultado.errors.length > 0) {
    return { error: `Erro ao ler o CSV: ${resultado.errors[0].message}` };
  }

  const linhas = resultado.data;
  if (linhas.length === 0) {
    return { error: "O arquivo não tem nenhuma linha de dados." };
  }

  const colunasEncontradas = Object.keys(linhas[0]);
  const temAlgumaColunaEsperada = COLUNAS_ESPERADAS_POSICOES.some((c) =>
    colunasEncontradas.includes(c),
  );
  if (!temAlgumaColunaEsperada) {
    return {
      error:
        "Nenhuma coluna esperada foi encontrada no CSV. Confira os cabeçalhos em docs/importacao.md " +
        `(esperado: ${COLUNAS_ESPERADAS_POSICOES.join(", ")}).`,
    };
  }

  if (linhas.length > LIMITE_LINHAS) {
    return { error: `O arquivo tem ${linhas.length} linhas — o limite por importação é ${LIMITE_LINHAS}.` };
  }

  const linhasParaStaging = linhas.map((linha) => ({
    placa: vazio(linha.placa),
    latitude_texto: vazio(linha.latitude),
    longitude_texto: vazio(linha.longitude),
    data_texto: vazio(linha.data),
    horario_texto: vazio(linha.horario),
  }));

  const supabase = await createClient();

  const { error: insertError } = await supabase
    .from("staging_posicao_veiculo")
    .insert(linhasParaStaging);
  if (insertError) return { error: `Erro ao gravar na staging: ${insertError.message}` };

  const { data: claims } = await supabase.auth.getClaims();
  const usuario = (claims?.claims?.email as string | undefined) ?? null;

  const { data: lote, error: rpcError } = await supabase.rpc("processar_staging_posicoes", {
    p_arquivo_nome: arquivo.name,
    p_usuario: usuario,
  });
  if (rpcError) return { error: `Erro ao processar a importação: ${rpcError.message}` };

  revalidatePath("/importacao");
  return {
    lote: { id: lote.id, total_linhas: lote.total_linhas, total_erros: lote.total_erros },
  };
}
