"use client";

import { useEffect } from "react";
import { Alert } from "@/components/ui/alert";
import { formatNumber } from "@/lib/format";

export type Progresso = { enviadas: number; total: number };

// Fechar/recarregar a aba no meio de uma importação em blocos deixaria o
// lote pela metade.
export function useAvisoAoSair(ativo: boolean) {
  useEffect(() => {
    if (!ativo) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [ativo]);
}

export function BarraProgresso({ progresso }: { progresso: Progresso }) {
  return (
    <div className="space-y-1" role="status" aria-live="polite">
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className="h-2 rounded-full bg-blue-600 transition-[width] dark:bg-blue-500"
          style={{ width: progresso.total ? `${(progresso.enviadas / progresso.total) * 100}%` : "0%" }}
        />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {progresso.total === 0
          ? "Lendo o arquivo..."
          : `${formatNumber(progresso.enviadas)} de ${formatNumber(progresso.total)} linhas processadas — não feche esta aba.`}
      </p>
    </div>
  );
}

export function ErrosPorMotivo({ erros }: { erros?: Record<string, number> }) {
  const motivos = Object.entries(erros ?? {}).sort((a, b) => b[1] - a[1]);
  if (motivos.length === 0) return null;
  return (
    <Alert variant="info">
      <p>Linhas não importadas, por motivo:</p>
      <ul className="mt-1 list-disc pl-5">
        {motivos.map(([motivo, qtd]) => (
          <li key={motivo}>
            {formatNumber(qtd)} — {motivo}
          </li>
        ))}
      </ul>
    </Alert>
  );
}
