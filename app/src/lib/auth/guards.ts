import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Garante que existe uma sessão válida no Supabase Auth (compartilhado com o
 * sistema de tickets).
 */
export async function requireAutenticado() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/login");
  }

  return data.claims;
}

/** Papel do usuário logado no schema `pedagio` (`admin`/`operador`), ou
 * `null` se ainda não foi definido. `cache()` evita repetir a consulta
 * quando o layout e a página chamam isso na mesma requisição. */
export const getMeuPapel = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("meu_papel");
  return data ?? null;
});

/** FASE 08: exige sessão válida E papel definido (admin ou operador) —
 * autenticado sem papel é bloqueado em `/sem-acesso` até um admin liberar. */
export async function requireAutorizado() {
  const claims = await requireAutenticado();
  const papel = await getMeuPapel();

  if (!papel) {
    redirect("/sem-acesso");
  }

  return { claims, papel };
}

export async function requireAdmin() {
  const { claims, papel } = await requireAutorizado();

  if (papel !== "admin") {
    redirect("/dashboard");
  }

  return { claims, papel };
}
