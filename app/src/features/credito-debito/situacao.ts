import type { StatusRole } from "@/lib/status-validacao";
import type { CreditoDebitoPorViagem } from "./queries";

export type SituacaoCreditoDebito = "ambos" | "so_credito" | "so_debito";

export const SITUACAO_INFO: Record<SituacaoCreditoDebito, { label: string; role: StatusRole }> = {
  ambos: { label: "Crédito e débito", role: "good" },
  so_credito: { label: "Só crédito (sem débito)", role: "warning" },
  so_debito: { label: "Só débito (sem crédito)", role: "neutral" },
};

export function situacaoDaLinha(
  row: Pick<CreditoDebitoPorViagem, "qtd_credito" | "qtd_debito">,
): SituacaoCreditoDebito {
  const temCredito = (row.qtd_credito ?? 0) > 0;
  const temDebito = (row.qtd_debito ?? 0) > 0;
  if (temCredito && temDebito) return "ambos";
  return temCredito ? "so_credito" : "so_debito";
}
