"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { COLUNAS_PLANILHA_PASSAGENS, type ColunaStagingPassagem } from "./planilha-passagens";
import { COLUNAS_PLANILHA_VIAGENS, type ColunaStagingViagem } from "./planilha-viagens";
import { COLUNAS_PLANILHA_POSICOES, type ColunaStagingPosicao } from "./planilha-posicoes";

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

// teto por bloco: TAMANHO_BLOCO_PASSAGENS / _VIAGENS ficam abaixo ou iguais
const LIMITE_BLOCO = 1000;
// posições de GPS são linhas curtas: 3.000 ≈ 360 KB (limite do Server Action: 1 MB)
const LIMITE_BLOCO_POSICOES = 3000;
const CADASTROS_CRIADOS_LISTADOS = 15;

export type LinhaStagingPassagem = Record<ColunaStagingPassagem, string | null> & { ocorrencia: number };
export type LinhaStagingViagem = Record<ColunaStagingViagem, string | null>;
export type LinhaStagingPosicao = Record<ColunaStagingPosicao, string | null>;

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
  tipo: "passagens" | "viagens_transporte" | "posicoes_gps",
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

function linhaPosicaoValida(linha: unknown): linha is LinhaStagingPosicao {
  if (typeof linha !== "object" || linha === null) return false;
  const l = linha as Record<string, unknown>;
  return COLUNAS_PLANILHA_POSICOES.every(({ coluna }) => l[coluna] === null || typeof l[coluna] === "string");
}

// Posições de GPS em blocos (FASE 27): mesmo fluxo de passagens/viagens. Os
// blocos não revalidam passagens (o trigger fica desligado dentro deles); a
// revalidação roda no fim, em blocos, com todas as posições já gravadas.
export async function iniciarImportacaoPosicoes(
  arquivoNome: string,
): Promise<{ loteId?: string; error?: string }> {
  return criarLote("posicoes_gps", arquivoNome);
}

// Lote de GPS do mesmo arquivo que parou no meio (aba fechada, resposta
// perdida): o app oferece continuar da linha em que parou. Cada linha do
// arquivo vira uma linha contada em total_linhas, na ordem do arquivo.
export async function buscarLotePosicoesIncompleto(
  arquivoNome: string,
  linhasNoArquivo: number,
): Promise<{ loteId: string; processadas: number; criadoEm: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lote_importacao")
    .select("id, total_linhas, created_at")
    .eq("tipo", "posicoes_gps")
    .eq("arquivo_nome", arquivoNome.slice(0, 255))
    .gt("created_at", new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const processadas = data?.total_linhas ?? 0;
  // igual ao arquivo = posições todas gravadas; o app oferece só a revalidação
  if (!data || processadas === 0 || processadas > linhasNoArquivo) return null;
  return { loteId: data.id, processadas, criadoEm: data.created_at };
}

// Quantas linhas do lote o banco já processou, esperando um bloco que ainda
// esteja em andamento terminar (staging do lote vazia). Usado para retomar
// depois de uma resposta que não chegou.
export async function progressoLotePosicoes(
  loteId: string,
): Promise<{ processadas?: number; pendentes?: number; error?: string }> {
  const supabase = await createClient();
  const [{ data, error }, { count }] = await Promise.all([
    supabase.from("lote_importacao").select("total_linhas").eq("id", loteId).single(),
    supabase.from("staging_posicao_veiculo").select("id", { count: "exact", head: true }).eq("lote_id", loteId),
  ]);
  if (error) return { error: error.message };
  return { processadas: data.total_linhas ?? 0, pendentes: count ?? 0 };
}

// Linhas gravadas na staging por um bloco que falhou antes de processá-las
// (não contam em total_linhas): descartadas para serem reenviadas a partir
// da última linha contada.
export async function descartarPendentesPosicoes(loteId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("staging_posicao_veiculo").delete().eq("lote_id", loteId);
  return error ? { error: error.message } : {};
}

export async function importarBlocoPosicoes(
  loteId: string,
  linhas: LinhaStagingPosicao[],
): Promise<{ processadas?: number; erros?: number; error?: string }> {
  if (!Array.isArray(linhas) || linhas.length === 0 || linhas.length > LIMITE_BLOCO_POSICOES) {
    return { error: `Bloco inválido (1 a ${LIMITE_BLOCO_POSICOES} linhas).` };
  }
  if (!linhas.every(linhaPosicaoValida)) return { error: "Bloco com linha em formato inesperado." };

  const supabase = await createClient();

  const { error: insertError } = await supabase
    .from("staging_posicao_veiculo")
    .insert(linhas.map((l) => ({ ...l, lote_id: loteId })));
  if (insertError) return { error: `Erro ao gravar na staging: ${insertError.message}` };

  const { data, error } = await supabase.rpc("processar_bloco_posicoes", {
    p_lote_id: loteId,
    p_limite: linhas.length,
  });
  if (error) return { error: `Erro ao processar o bloco: ${error.message}` };

  const resultado = data as { processadas: number; erros: number };
  return { processadas: resultado.processadas, erros: resultado.erros };
}

// Um bloco da revalidação final; apos = última passagem do bloco anterior
// (nulo na primeira chamada, que também devolve o total)
export async function revalidarBlocoPosicoes(
  loteId: string,
  apos: string | null,
  limite: number,
): Promise<{ processadas?: number; ultimoId?: string | null; total?: number | null; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revalidar_bloco_passagens_gps", {
    p_lote_id: loteId,
    p_apos: apos,
    p_limite: limite,
  });
  if (error) return { error: `Erro ao revalidar as passagens: ${error.message}` };

  const r = data as { processadas: number; ultimo_id: string | null; total: number | null };
  return { processadas: r.processadas, ultimoId: r.ultimo_id, total: r.total };
}

export async function finalizarImportacaoPosicoes(loteId: string): Promise<ImportacaoState> {
  const supabase = await createClient();

  await atualizarEstatisticas(supabase);

  const { data: lote, error } = await supabase
    .from("lote_importacao")
    .select("id, total_linhas, total_erros, erros_por_motivo")
    .eq("id", loteId)
    .single();
  if (error) return { error: `Erro ao ler o resultado do lote: ${error.message}` };

  revalidatePath("/importacao");
  revalidatePath("/rastreamento");
  revalidatePath("/passagens");
  revalidatePath("/dashboard");
  return {
    lote: { id: lote.id, total_linhas: lote.total_linhas, total_erros: lote.total_erros },
    errosPorMotivo: (lote.erros_por_motivo ?? {}) as Record<string, number>,
  };
}
