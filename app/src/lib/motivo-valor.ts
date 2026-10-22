// Conferência por tarifa por eixo (FASE 24, validacao_passagem.motivo_valor).
// sem_tarifa não é valor da coluna — é como vw_divergencia_por_motivo agrupa
// os débitos sem tarifa vigente.
export const LABEL_MOTIVO_VALOR: Record<string, string> = {
  completo: "Eixos completos",
  eixos_suspensos: "Eixos suspensos",
  eixos_a_maior: "Eixos a maior",
  nao_multiplo: "Valor fora da tarifa",
  sem_tarifa: "Sem tarifa",
};

export const OPCOES_MOTIVO_VALOR = Object.entries(LABEL_MOTIVO_VALOR).map(([value, label]) => ({ value, label }));

export function motivoValorLabel(motivo: string | null): string {
  if (!motivo) return "—";
  return LABEL_MOTIVO_VALOR[motivo] ?? motivo;
}

type Conferencia = {
  motivo_valor: string | null;
  eixos_cobrados: number | null;
  eixos_composicao: number | null;
  desconto_tag: boolean | null;
};

// "4 de 7 eixos (suspensos), TAG −5%" — curto o bastante pra lista e pro detalhe
export function descreverEixos(c: Conferencia): string {
  if (!c.motivo_valor) return "—";
  if (c.motivo_valor === "nao_multiplo" || c.eixos_cobrados === null) {
    return "valor não é múltiplo da tarifa por eixo";
  }
  const base = `${c.eixos_cobrados} de ${c.eixos_composicao} eixos`;
  const sufixo =
    c.motivo_valor === "eixos_suspensos" ? " (suspensos)" : c.motivo_valor === "eixos_a_maior" ? " (a maior)" : "";
  return `${base}${sufixo}${c.desconto_tag ? ", TAG −5%" : ""}`;
}
