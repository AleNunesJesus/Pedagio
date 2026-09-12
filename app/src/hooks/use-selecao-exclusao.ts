"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Compartilhado pelas telas com exclusão em lote (admin-only): Passagens,
// Rastreamento (posições), Viagens de transporte, lotes de Importação.
export function useSelecaoExclusao(
  excluir: (ids: string[]) => Promise<{ error?: string }>,
) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggle(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodos(ids: string[]) {
    setSelecionados((prev) => (prev.size === ids.length ? new Set() : new Set(ids)));
  }

  function excluirSelecionados() {
    if (selecionados.size === 0) return;
    if (
      !window.confirm(
        `Excluir ${selecionados.size} registro(s) selecionado(s)? Essa ação não pode ser desfeita.`,
      )
    ) {
      return;
    }
    setErro(null);
    startTransition(async () => {
      const resultado = await excluir(Array.from(selecionados));
      if (resultado.error) {
        setErro(resultado.error);
        return;
      }
      setSelecionados(new Set());
      router.refresh();
    });
  }

  return { selecionados, toggle, toggleTodos, excluirSelecionados, pending, erro };
}
