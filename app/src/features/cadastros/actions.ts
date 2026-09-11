"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { categoriaSchema, veiculoSchema, pracaSchema, tarifaSchema } from "./schemas";

export type FormState = { error?: string; success?: boolean };

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

export async function criarCategoria(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = categoriaSchema.safeParse({
    codigo: formData.get("codigo"),
    descricao: formData.get("descricao"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("categoria_veiculo").insert(parsed.data);
  if (error) {
    return {
      error: error.code === "23505" ? "Já existe uma categoria com esse código." : error.message,
    };
  }

  revalidatePath("/cadastros/categorias");
  return { success: true };
}

export async function criarVeiculo(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = veiculoSchema.safeParse({
    placa: formData.get("placa"),
    categoria_veiculo_id: formData.get("categoria_veiculo_id"),
    frota: formData.get("frota") || undefined,
    ativo: formData.get("ativo") === "on",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("veiculo").insert(parsed.data);
  if (error) {
    return {
      error: error.code === "23505" ? "Já existe um veículo com essa placa." : error.message,
    };
  }

  revalidatePath("/cadastros/veiculos");
  return { success: true };
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

export async function criarTarifa(
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

  const supabase = await createClient();
  const { error } = await supabase.from("tarifa_praca").insert({
    ...parsed.data,
    vigencia_fim: parsed.data.vigencia_fim ?? null,
  });

  if (error) {
    return {
      error:
        error.code === "23P01"
          ? "Já existe uma tarifa vigente para essa praça e categoria nesse período."
          : error.message,
    };
  }

  revalidatePath("/cadastros/tarifas");
  return { success: true };
}
