"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ImportacaoState = {
  error?: string;
  lote?: {
    id: string;
    total_linhas: number | null;
    total_erros: number | null;
  };
};

const COLUNAS_ESPERADAS = [
  "numero_fatura",
  "data_texto",
  "horario_texto",
  "placa",
  "tipo_veiculo",
  "praca_nome",
  "tipo_uso_texto",
  "valor_texto",
  "condicao_texto",
  "viagem",
  "embarcador",
  "sentido",
] as const;

const LIMITE_LINHAS = 5000;

function vazio(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const trimmed = valor.trim();
  return trimmed === "" ? null : trimmed;
}

export async function importarPlanilha(
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
  const temAlgumaColunaEsperada = COLUNAS_ESPERADAS.some((c) => colunasEncontradas.includes(c));
  if (!temAlgumaColunaEsperada) {
    return {
      error:
        "Nenhuma coluna esperada foi encontrada no CSV. Confira os cabeçalhos em docs/importacao.md " +
        `(esperado: ${COLUNAS_ESPERADAS.join(", ")}).`,
    };
  }

  if (linhas.length > LIMITE_LINHAS) {
    return { error: `O arquivo tem ${linhas.length} linhas — o limite por importação é ${LIMITE_LINHAS}.` };
  }

  const linhasParaStaging = linhas.map((linha) => ({
    numero_fatura: vazio(linha.numero_fatura),
    data_texto: vazio(linha.data_texto),
    horario_texto: vazio(linha.horario_texto),
    placa: vazio(linha.placa),
    tipo_veiculo: vazio(linha.tipo_veiculo),
    praca_nome: vazio(linha.praca_nome),
    tipo_uso_texto: vazio(linha.tipo_uso_texto),
    valor_texto: vazio(linha.valor_texto),
    condicao_texto: vazio(linha.condicao_texto),
    viagem: vazio(linha.viagem),
    embarcador: vazio(linha.embarcador),
    sentido: vazio(linha.sentido),
  }));

  const supabase = await createClient();

  const { error: insertError } = await supabase
    .from("staging_passagem_pedagio")
    .insert(linhasParaStaging);
  if (insertError) return { error: `Erro ao gravar na staging: ${insertError.message}` };

  const { data: claims } = await supabase.auth.getClaims();
  const usuario = (claims?.claims?.email as string | undefined) ?? null;

  const { data: lote, error: rpcError } = await supabase.rpc("processar_staging_passagens", {
    p_arquivo_nome: arquivo.name,
    p_usuario: usuario,
  });
  if (rpcError) return { error: `Erro ao processar a importação: ${rpcError.message}` };

  revalidatePath("/importacao");
  return {
    lote: { id: lote.id, total_linhas: lote.total_linhas, total_erros: lote.total_erros },
  };
}

const COLUNAS_ESPERADAS_VIAGENS = [
  "placa",
  "numero_transporte",
  "cidade_origem",
  "uf_origem",
  "cidade_destino",
  "uf_destino",
  "data_hora_saida",
  "data_hora_chegada",
  "carreta1",
  "carreta2",
  "tipo_viagem",
] as const;

export async function importarViagensTransporte(
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
  const temAlgumaColunaEsperada = COLUNAS_ESPERADAS_VIAGENS.some((c) =>
    colunasEncontradas.includes(c),
  );
  if (!temAlgumaColunaEsperada) {
    return {
      error:
        "Nenhuma coluna esperada foi encontrada no CSV. Confira os cabeçalhos em docs/importacao.md " +
        `(esperado: ${COLUNAS_ESPERADAS_VIAGENS.join(", ")}).`,
    };
  }

  if (linhas.length > LIMITE_LINHAS) {
    return { error: `O arquivo tem ${linhas.length} linhas — o limite por importação é ${LIMITE_LINHAS}.` };
  }

  const linhasParaStaging = linhas.map((linha) => ({
    placa: vazio(linha.placa),
    numero_transporte: vazio(linha.numero_transporte),
    cidade_origem: vazio(linha.cidade_origem),
    uf_origem: vazio(linha.uf_origem),
    cidade_destino: vazio(linha.cidade_destino),
    uf_destino: vazio(linha.uf_destino),
    data_hora_saida_texto: vazio(linha.data_hora_saida),
    data_hora_chegada_texto: vazio(linha.data_hora_chegada),
    carreta1: vazio(linha.carreta1),
    carreta2: vazio(linha.carreta2),
    tipo_viagem_texto: vazio(linha.tipo_viagem),
  }));

  const supabase = await createClient();

  const { error: insertError } = await supabase
    .from("staging_viagem_transporte")
    .insert(linhasParaStaging);
  if (insertError) return { error: `Erro ao gravar na staging: ${insertError.message}` };

  const { data: claims } = await supabase.auth.getClaims();
  const usuario = (claims?.claims?.email as string | undefined) ?? null;

  const { data: lote, error: rpcError } = await supabase.rpc("processar_staging_viagens_transporte", {
    p_arquivo_nome: arquivo.name,
    p_usuario: usuario,
  });
  if (rpcError) return { error: `Erro ao processar a importação: ${rpcError.message}` };

  revalidatePath("/importacao");
  revalidatePath("/viagens-transporte");
  return {
    lote: { id: lote.id, total_linhas: lote.total_linhas, total_erros: lote.total_erros },
  };
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
