import { getMeuPapel } from "@/lib/auth/guards";
import { listEstacionamentos } from "@/features/cadastros/queries";
import { EstacionamentoList } from "@/features/cadastros/components/estacionamento-list";
import { LinkButton } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { formatNumber } from "@/lib/format";

export default async function EstacionamentosPage() {
  const [estacionamentos, papel] = await Promise.all([listEstacionamentos(), getMeuPapel()]);
  const pendentes = estacionamentos.filter((e) => e.cadastro_pendente).length;

  return (
    <div className="space-y-6">
      {papel === "admin" && (
        <div className="flex justify-end">
          <LinkButton href="/cadastros/estacionamentos/novo">Novo estacionamento</LinkButton>
        </div>
      )}
      {pendentes > 0 && (
        <Alert variant="warning">
          {formatNumber(pendentes)} estacionamento(s) criado(s) automaticamente pela importação da
          fatura, só com o nome da planilha. Até o polígono ser desenhado, as passagens desses
          estacionamentos ficam como &quot;Sem cadastro&quot;.{" "}
          {papel === "admin"
            ? "Abra cada um para completar o cadastro — ao salvar, as passagens são revalidadas."
            : "Peça a um administrador para completar o cadastro."}
        </Alert>
      )}
      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <EstacionamentoList rows={estacionamentos} isAdmin={papel === "admin"} />
      </section>
    </div>
  );
}
