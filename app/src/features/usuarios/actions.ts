"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; success?: boolean };

export async function salvarPapel(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = formData.get("user_id") as string | null;
  const papel = formData.get("papel") as string | null;
  if (!userId || !papel) return { error: "Dados inválidos." };

  const supabase = await createClient();

  const { error } =
    papel === "sem_acesso"
      ? await supabase.rpc("remover_papel", { p_user_id: userId })
      : await supabase.rpc("definir_papel", { p_user_id: userId, p_papel: papel });

  if (error) return { error: error.message };

  revalidatePath("/usuarios");
  return { success: true };
}
