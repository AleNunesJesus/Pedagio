import { createClient } from "@/lib/supabase/server";

export type Usuario = { user_id: string; email: string | null; papel: string | null };

export async function listUsuarios(): Promise<Usuario[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("listar_usuarios");
  if (error) throw error;
  return data ?? [];
}
