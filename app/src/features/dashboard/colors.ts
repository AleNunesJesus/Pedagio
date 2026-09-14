// Paleta validada da skill dataviz (references/palette.md) — não alterar os
// hexadecimais categóricos/sequencial sem rodar o validador de novo. Cores
// categóricas e a sequencial são as mesmas nos dois temas (saturação
// suficiente pra funcionar em claro e escuro); só a tinta neutra (eixos,
// grid, legendas) muda por tema — recharts desenha em SVG e não responde a
// classes `dark:`, então precisa de um valor de cor calculado (ver
// `ink(tema)` + hook `useTema`).

export const CATEGORICAL = {
  blue: "#2a78d6",
  orange: "#eb6834",
  aqua: "#1baf7a",
} as const;

export const SEQUENTIAL_BLUE = "#2a78d6";

const INK_LIGHT = {
  primary: "#0b0b0b",
  secondary: "#52514e",
  muted: "#898781",
  grid: "#e1e0d9",
  baseline: "#c3c2b7",
  dotStroke: "#fcfcfb",
} as const;

const INK_DARK = {
  primary: "#f5f4f1",
  secondary: "#c7c5be",
  muted: "#a3a199",
  grid: "#3a3835",
  baseline: "#4d4a45",
  dotStroke: "#111827",
} as const;

export function ink(tema: "light" | "dark") {
  return tema === "dark" ? INK_DARK : INK_LIGHT;
}
