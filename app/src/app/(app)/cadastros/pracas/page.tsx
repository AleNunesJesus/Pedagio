import { getMeuPapel } from "@/lib/auth/guards";
import { listPracas } from "@/features/cadastros/queries";
import { PracaList } from "@/features/cadastros/components/praca-list";
import { LinkButton } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { formatNumber } from "@/lib/format";

export default async function PracasPage() {
  const [pracas, papel] = await Promise.all([listPracas(), getMeuPapel()]);
  const pendentes = pracas.filter((p) => p.cadastro_pendente).length;

  return (
    <div className="space-y-6">
      {papel === "admin" && (
        <div className="flex justify-end">
          <LinkButton href="/cadastros/pracas/nova">Nova praça</LinkButton>
        </div>
      )}
      {pendentes > 0 && (
        <Alert variant="warning">
          {formatNumber(pendentes)} praça(s) criada(s) automaticamente pela importação da fatura,
          só com nome e sentido da planilha. Até o polígono ser desenhado, as passagens dessas
          praças ficam como &quot;Sem cadastro&quot;.{" "}
          {papel === "admin"
            ? "Abra cada uma para completar o cadastro — ao salvar, as passagens são revalidadas."
            : "Peça a um administrador para completar o cadastro."}
        </Alert>
      )}
      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <PracaList rows={pracas} isAdmin={papel === "admin"} />
      </section>
    </div>
  );
}
