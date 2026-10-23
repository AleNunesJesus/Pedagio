import { getMeuPapel } from "@/lib/auth/guards";
import { listCategorias } from "@/features/cadastros/queries";
import { CategoriaForm } from "@/features/cadastros/components/categoria-form";
import { CategoriaList } from "@/features/cadastros/components/categoria-list";
import { ListaComPainel, PainelNovo } from "@/components/layout/lista-com-painel";
import { contem } from "@/lib/texto";

export default async function CategoriasPage({ searchParams }: { searchParams: Promise<{ busca?: string }> }) {
  const [params, categorias, papel] = await Promise.all([searchParams, listCategorias(), getMeuPapel()]);
  const rows = categorias.filter((c) => contem(params.busca, c.codigo, c.descricao));

  return (
    <ListaComPainel
      titulo="Categorias"
      total={rows.length}
      unidade="categoria(s)"
      busca={{ formId: "busca-categorias", valor: params.busca, placeholder: "Buscar código ou descrição" }}
      detalhe={
        papel === "admin" ? (
          <PainelNovo titulo="Nova categoria">
            <CategoriaForm />
          </PainelNovo>
        ) : undefined
      }
    >
      <CategoriaList rows={rows} isAdmin={papel === "admin"} />
    </ListaComPainel>
  );
}
