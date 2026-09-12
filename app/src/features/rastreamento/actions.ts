"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function excluirPosicoes(ids: string[]): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("excluir_posicoes", { p_ids: ids.map(Number) });
  if (error) return { error: error.message };

  revalidatePath("/rastreamento");
  return {};
}
