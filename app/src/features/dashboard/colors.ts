// Paleta validada da skill dataviz (references/palette.md) — não alterar
// hexadecimais sem rodar o validador de novo.

export const CATEGORICAL = {
  blue: "#2a78d6",
  orange: "#eb6834",
} as const;

export const SEQUENTIAL_BLUE = "#2a78d6";

export const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
  neutral: "#898781",
} as const;

export const INK = {
  primary: "#0b0b0b",
  secondary: "#52514e",
  muted: "#898781",
  grid: "#e1e0d9",
  baseline: "#c3c2b7",
} as const;

export type StatusRole = keyof typeof STATUS;

export const STATUS_VALIDACAO_INFO: Record<
  string,
  { label: string; role: StatusRole }
> = {
  ok: { label: "OK", role: "good" },
  pendente: { label: "Pendente", role: "neutral" },
  sem_dados_gps: { label: "Sem dados de GPS", role: "warning" },
  sem_cadastro: { label: "Sem cadastro", role: "warning" },
  valor_divergente: { label: "Valor divergente", role: "serious" },
  fora_poligono: { label: "Fora do polígono", role: "critical" },
  local_e_valor_divergentes: {
    label: "Local e valor divergentes",
    role: "critical",
  },
};
