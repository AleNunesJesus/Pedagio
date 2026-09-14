import { STATUS } from "@/lib/status-validacao";
import { formatBRL } from "@/lib/format";

// Divergência = cobrado - esperado: positivo é cobrado a mais (risco,
// mesma cor "critical" de fora_poligono/local_e_valor_divergentes),
// negativo é cobrado a menos (favorável, cor "good"). O sinal já está no
// valor formatado (nunca só a cor).
export function DivergenciaValor({ valor }: { valor: number | null }) {
  const v = valor ?? 0;
  const color = v > 0 ? STATUS.critical : v < 0 ? STATUS.good : STATUS.neutral;
  const texto = v > 0 ? `+${formatBRL(v)}` : formatBRL(v);

  return <span style={{ color }}>{texto}</span>;
}

// total_esperado nulo (sem_cadastro/nao_aplicavel/pendente) não é "esperado
// zero" — é "não há tarifa de referência calculada para comparar".
export function valorEsperadoLabel(valor: number | null): string {
  return valor === null ? "sem tarifa de referência" : formatBRL(valor);
}
