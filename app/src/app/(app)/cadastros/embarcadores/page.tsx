import { getMeuPapel } from "@/lib/auth/guards";
import { listEmbarcadores } from "@/features/cadastros/queries";
import { EmbarcadorList } from "@/features/cadastros/components/embarcador-list";

export default async function EmbarcadoresPage() {
  const [embarcadores, papel] = await Promise.all([listEmbarcadores(), getMeuPapel()]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Embarcadores são criados automaticamente ao importar passagens com
        crédito vinculado a uma viagem — não há cadastro manual.
        {papel === "admin" && " Edite o CNPJ quando precisar."}
      </p>
      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <EmbarcadorList rows={embarcadores} podeEditar={papel === "admin"} />
      </section>
    </div>
  );
}
