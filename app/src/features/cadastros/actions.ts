"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  categoriaSchema,
  veiculoSchema,
  pracaSchema,
  tarifaSchema,
  estacionamentoSchema,
  tarifaEstacionamentoSchema,
} from "./schemas";

export type FormState = { error?: string; success?: boolean };

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

export async function salvarCategoria(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = categoriaSchema.safeParse({
    codigo: formData.get("codigo"),
    descricao: formData.get("descricao"),
    quantidade_eixos: formData.get("quantidade_eixos"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const categoriaId = formData.get("categoria_id") as string | null;
  const supabase = await createClient();
  const { error } = categoriaId
    ? await supabase.from("categoria_veiculo").update(parsed.data).eq("id", categoriaId)
    : await supabase.from("categoria_veiculo").insert(parsed.data);
  if (error) {
    return {
      error: error.code === "23505" ? "Já existe uma categoria com esse código." : error.message,
    };
  }

  revalidatePath("/cadastros/categorias");
  if (categoriaId) revalidatePath(`/cadastros/categorias/${categoriaId}`);
  return { success: true };
}

export async function excluirCategorias(ids: string[]): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("excluir_categorias", { p_ids: ids });
  if (error) {
    return {
      error:
        error.code === "23503"
          ? "Não é possível excluir: há veículos, tarifas ou passagens validadas usando esta categoria."
          : error.message,
    };
  }

  revalidatePath("/cadastros/categorias");
  return {};
}

export async function salvarVeiculo(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = veiculoSchema.safeParse({
    placa: formData.get("placa"),
    tipo: formData.get("tipo"),
    categoria_veiculo_id: formData.get("categoria_veiculo_id"),
    categoria_fallback_id: formData.get("categoria_fallback_id") || undefined,
    frota: formData.get("frota") || undefined,
    ativo: formData.get("ativo") === "on",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const veiculoId = formData.get("veiculo_id") as string | null;
  const payload = {
    placa: parsed.data.placa,
    tipo: parsed.data.tipo,
    categoria_veiculo_id: parsed.data.categoria_veiculo_id,
    categoria_fallback_id: parsed.data.tipo === "cavalo" ? parsed.data.categoria_fallback_id : null,
    frota: parsed.data.frota ?? null,
    ativo: parsed.data.ativo,
  };

  const supabase = await createClient();
  const { error } = veiculoId
    ? await supabase.from("veiculo").update(payload).eq("id", veiculoId)
    : await supabase.from("veiculo").insert(payload);
  if (error) {
    return {
      error: error.code === "23505" ? "Já existe um veículo com essa placa." : error.message,
    };
  }

  revalidatePath("/cadastros/veiculos");
  if (veiculoId) revalidatePath(`/cadastros/veiculos/${veiculoId}`);
  return { success: true };
}

export async function excluirVeiculos(ids: string[]): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("excluir_veiculos", { p_ids: ids });
  if (error) {
    return {
      error:
        error.code === "23503"
          ? "Não é possível excluir: há passagens, posições de GPS ou viagens de transporte vinculadas a este veículo/carreta."
          : error.message,
    };
  }

  revalidatePath("/cadastros/veiculos");
  return {};
}

export async function salvarPraca(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = pracaSchema.safeParse({
    nome: formData.get("nome"),
    rodovia: formData.get("rodovia") || undefined,
    concessionaria: formData.get("concessionaria") || undefined,
    km: formData.get("km") || undefined,
    sentido: formData.get("sentido") || undefined,
    ativo: formData.get("ativo") === "on",
    poligono_geojson: formData.get("poligono_geojson"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const pracaId = formData.get("praca_id") as string | null;
  const supabase = await createClient();

  const rpc = pracaId ? "atualizar_praca" : "criar_praca";
  const args = pracaId
    ? { p_id: pracaId, p_nome: parsed.data.nome, p_poligono_geojson: parsed.data.poligono_geojson, p_rodovia: parsed.data.rodovia ?? null, p_concessionaria: parsed.data.concessionaria ?? null, p_km: parsed.data.km ?? null, p_sentido: parsed.data.sentido ?? null, p_ativo: parsed.data.ativo }
    : { p_nome: parsed.data.nome, p_poligono_geojson: parsed.data.poligono_geojson, p_rodovia: parsed.data.rodovia ?? null, p_concessionaria: parsed.data.concessionaria ?? null, p_km: parsed.data.km ?? null, p_sentido: parsed.data.sentido ?? null, p_ativo: parsed.data.ativo };

  const { error } = await supabase.rpc(rpc, args);
  if (error) return { error: error.message };

  revalidatePath("/cadastros/pracas");
  return { success: true };
}

export async function excluirPracas(ids: string[]): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("excluir_pracas", { p_ids: ids });
  if (error) {
    return {
      error:
        error.code === "23503"
          ? "Não é possível excluir: há tarifas ou passagens vinculadas a esta praça."
          : error.message,
    };
  }

  revalidatePath("/cadastros/pracas");
  return {};
}

export async function salvarTarifa(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = tarifaSchema.safeParse({
    praca_id: formData.get("praca_id"),
    categoria_veiculo_id: formData.get("categoria_veiculo_id"),
    valor: formData.get("valor"),
    vigencia_inicio: formData.get("vigencia_inicio"),
    vigencia_fim: formData.get("vigencia_fim") || undefined,
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const tarifaId = formData.get("tarifa_id") as string | null;
  const payload = { ...parsed.data, vigencia_fim: parsed.data.vigencia_fim ?? null };
  const supabase = await createClient();
  const { error } = tarifaId
    ? await supabase.from("tarifa_praca").update(payload).eq("id", tarifaId)
    : await supabase.from("tarifa_praca").insert(payload);

  if (error) {
    return {
      error:
        error.code === "23P01"
          ? "Já existe uma tarifa vigente para essa praça e categoria nesse período."
          : error.message,
    };
  }

  revalidatePath("/cadastros/tarifas");
  if (tarifaId) revalidatePath(`/cadastros/tarifas/${tarifaId}`);
  return { success: true };
}

export async function excluirTarifas(ids: string[]): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("excluir_tarifas", { p_ids: ids });
  if (error) return { error: error.message };

  revalidatePath("/cadastros/tarifas");
  return {};
}

export async function salvarEstacionamento(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = estacionamentoSchema.safeParse({
    nome: formData.get("nome"),
    ativo: formData.get("ativo") === "on",
    poligono_geojson: formData.get("poligono_geojson"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const estacionamentoId = formData.get("estacionamento_id") as string | null;
  const supabase = await createClient();

  const rpc = estacionamentoId ? "atualizar_estacionamento" : "criar_estacionamento";
  const args = estacionamentoId
    ? { p_id: estacionamentoId, p_nome: parsed.data.nome, p_poligono_geojson: parsed.data.poligono_geojson, p_ativo: parsed.data.ativo }
    : { p_nome: parsed.data.nome, p_poligono_geojson: parsed.data.poligono_geojson, p_ativo: parsed.data.ativo };

  const { error } = await supabase.rpc(rpc, args);
  if (error) return { error: error.message };

  revalidatePath("/cadastros/estacionamentos");
  return { success: true };
}

export async function excluirEstacionamentos(ids: string[]): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("excluir_estacionamentos", { p_ids: ids });
  if (error) {
    return {
      error:
        error.code === "23503"
          ? "Não é possível excluir: há tarifas ou passagens vinculadas a este estacionamento."
          : error.message,
    };
  }

  revalidatePath("/cadastros/estacionamentos");
  return {};
}

export async function salvarTarifaEstacionamento(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = tarifaEstacionamentoSchema.safeParse({
    estacionamento_id: formData.get("estacionamento_id"),
    valor_diaria: formData.get("valor_diaria"),
    vigencia_inicio: formData.get("vigencia_inicio"),
    vigencia_fim: formData.get("vigencia_fim") || undefined,
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const tarifaId = formData.get("tarifa_id") as string | null;
  const payload = { ...parsed.data, vigencia_fim: parsed.data.vigencia_fim ?? null };
  const supabase = await createClient();
  const { error } = tarifaId
    ? await supabase.from("tarifa_estacionamento").update(payload).eq("id", tarifaId)
    : await supabase.from("tarifa_estacionamento").insert(payload);

  if (error) {
    return {
      error:
        error.code === "23P01"
          ? "Já existe uma tarifa vigente para esse estacionamento nesse período."
          : error.message,
    };
  }

  revalidatePath("/cadastros/tarifas-estacionamento");
  if (tarifaId) revalidatePath(`/cadastros/tarifas-estacionamento/${tarifaId}`);
  return { success: true };
}

export async function excluirTarifasEstacionamento(ids: string[]): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("excluir_tarifas_estacionamento", { p_ids: ids });
  if (error) return { error: error.message };

  revalidatePath("/cadastros/tarifas-estacionamento");
  return {};
}

export async function atualizarEmbarcadorCnpj(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = formData.get("id") as string | null;
  const cnpj = (formData.get("cnpj") as string | null)?.trim() || null;
  if (!id) return { error: "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.from("embarcador").update({ cnpj }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/cadastros/embarcadores");
  return { success: true };
}

export async function excluirEmbarcadores(ids: string[]): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("excluir_embarcadores", { p_ids: ids });
  if (error) {
    return {
      error:
        error.code === "23503"
          ? "Não é possível excluir: há passagens ou viagens de transporte vinculadas a este embarcador."
          : error.message,
    };
  }

  revalidatePath("/cadastros/embarcadores");
  return {};
}
