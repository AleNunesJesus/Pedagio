// Paleta de status (não temática, ver dataviz skill references/palette.md) —
// status é estado, não identidade de série, por isso fica separada da paleta
// categórica dos gráficos.
export const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
  neutral: "#898781",
} as const;

export type StatusRole = keyof typeof STATUS;

export const STATUS_VALIDACAO_INFO: Record<string, { label: string; role: StatusRole }> = {
  ok: { label: "OK", role: "good" },
  pendente: { label: "Pendente", role: "neutral" },
  sem_dados_gps: { label: "Sem dados de GPS", role: "warning" },
  sem_cadastro: { label: "Sem cadastro", role: "warning" },
  valor_divergente: { label: "Valor divergente", role: "serious" },
  fora_poligono: { label: "Fora do polígono", role: "critical" },
  local_e_valor_divergentes: { label: "Local e valor divergentes", role: "critical" },
};

export function statusLabel(status: string | null): string {
  if (!status) return "—";
  return STATUS_VALIDACAO_INFO[status]?.label ?? status;
}
