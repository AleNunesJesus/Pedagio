import { getMeuPapel } from "@/lib/auth/guards";
import { listEmbarcadores } from "@/features/cadastros/queries";
import { EmbarcadorList } from "@/features/cadastros/components/embarcador-list";
import { ListaComPainel } from "@/components/layout/lista-com-painel";
import { contem } from "@/lib/texto";

export default async function EmbarcadoresPage({ searchParams }: { searchParams: Promise<{ busca?: string }> }) {
  const [params, embarcadores, papel] = await Promise.all([searchParams, listEmbarcadores(), getMeuPapel()]);
  const rows = embarcadores.filter((e) => contem(params.busca, e.nome, e.cnpj));

  return (
    <ListaComPainel
      titulo="Embarcadores"
      total={rows.length}
      unidade="embarcador(es)"
      busca={{ formId: "busca-embarcadores", valor: params.busca, placeholder: "Buscar nome ou CNPJ" }}
    >
      <p className="mb-3 px-1 text-sm text-gray-600 dark:text-gray-400">
        Embarcadores são criados automaticamente ao importar passagens com crédito vinculado a uma
        viagem — não há cadastro manual.
        {papel === "admin" && " Edite o CNPJ quando precisar."}
      </p>
      <EmbarcadorList rows={rows} podeEditar={papel === "admin"} />
    </ListaComPainel>
  );
}
