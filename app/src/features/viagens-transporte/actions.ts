"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function excluirViagensTransporte(ids: string[]): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("excluir_viagens_transporte", { p_ids: ids });
  if (error) return { error: error.message };

  revalidatePath("/viagens-transporte");
  return {};
}
