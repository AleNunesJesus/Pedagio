// Tipos de uso de pedagio.passagem_pedagio (CHECK passagem_pedagio_tipo_uso_check).
// adesao / outras_taxas / credito_plano_contratado vieram da fatura real
// (FASE 23) e, como contrato, não passam pela validação de praça.
export const LABEL_TIPO_USO: Record<string, string> = {
  passagem: "Passagem",
  contrato: "Contrato",
  estacionamento: "Estacionamento",
  adesao: "Adesão",
  outras_taxas: "Outras taxas",
  credito_plano_contratado: "Crédito plano contratado",
};

export const OPCOES_TIPO_USO = Object.entries(LABEL_TIPO_USO).map(([value, label]) => ({ value, label }));

export function tipoUsoLabel(tipo: string | null): string {
  if (!tipo) return "—";
  return LABEL_TIPO_USO[tipo] ?? tipo;
}
