import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Garante que existe uma sessão válida no Supabase Auth (compartilhado com o
 * sistema de tickets). Diferente do projeto de tickets, o Pedagio não tem
 * tabela de perfil própria: qualquer usuário autenticado tem acesso total
 * (decisão do usuário, FASE 06) — não há checagem de papel/ativo aqui.
 */
export async function requireAutenticado() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/login");
  }

  return data.claims;
}
