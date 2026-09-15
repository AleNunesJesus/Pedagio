import { getMeuPapel } from "@/lib/auth/guards";
import { listEstacionamentos } from "@/features/cadastros/queries";
import { EstacionamentoList } from "@/features/cadastros/components/estacionamento-list";
import { LinkButton } from "@/components/ui/button";

export default async function EstacionamentosPage() {
  const [estacionamentos, papel] = await Promise.all([listEstacionamentos(), getMeuPapel()]);

  return (
    <div className="space-y-6">
      {papel === "admin" && (
        <div className="flex justify-end">
          <LinkButton href="/cadastros/estacionamentos/novo">Novo estacionamento</LinkButton>
        </div>
      )}
      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <EstacionamentoList rows={estacionamentos} isAdmin={papel === "admin"} />
      </section>
    </div>
  );
}
