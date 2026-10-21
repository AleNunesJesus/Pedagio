import { STATUS } from "@/lib/status-validacao";

// Praça/estacionamento criado automaticamente pela importação da fatura
// (FASE 22) — só tem nome/sentido da planilha, falta polígono e o resto.
export function CadastroPendenteBadge({
  pendente,
  origem,
}: {
  pendente: boolean;
  origem?: { arquivo_nome: string | null; created_at: string } | null;
}) {
  if (!pendente) return <span>Completo</span>;

  const titulo = origem
    ? `Criado pela importação ${origem.arquivo_nome ?? ""} em ${new Date(origem.created_at).toLocaleString("pt-BR")}`
    : "Criado pela importação da fatura";

  return (
    <span className="inline-flex items-center gap-1.5" title={titulo}>
      <span
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: STATUS.warning }}
        aria-hidden
      />
      Cadastro pendente
    </span>
  );
}
