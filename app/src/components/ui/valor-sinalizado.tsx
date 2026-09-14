import { STATUS } from "@/lib/status-validacao";
import { formatBRL } from "@/lib/format";

// Convenção usada em todo o app pra números "com sinal": positivo é
// desfavorável (cor critical, ex.: cobrado a mais que a tarifa, praça
// debitando mais que o embarcador creditou), negativo é favorável (cor
// good). O sinal sempre aparece no texto também — nunca só a cor.
export function ValorSinalizado({ valor }: { valor: number | null }) {
  const v = valor ?? 0;
  const color = v > 0 ? STATUS.critical : v < 0 ? STATUS.good : STATUS.neutral;
  const texto = v > 0 ? `+${formatBRL(v)}` : formatBRL(v);

  return <span style={{ color }}>{texto}</span>;
}
