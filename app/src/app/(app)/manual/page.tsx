import { requireAutorizado } from "@/lib/auth/guards";
import type { Papel } from "@/features/manual/tipos";
import { ManualNav } from "@/features/manual/components/manual-nav";
import { SecaoPrimeirosPassos } from "@/features/manual/components/secao-primeiros-passos";
import { SecaoConsulta } from "@/features/manual/components/secao-consulta";
import { SecaoImportacao } from "@/features/manual/components/secao-importacao";
import { SecaoCadastros } from "@/features/manual/components/secao-cadastros";
import { SecaoAdministracao } from "@/features/manual/components/secao-administracao";
import { SecaoReferencia } from "@/features/manual/components/secao-referencia";

export default async function ManualPage() {
  const { papel } = await requireAutorizado();
  const isAdmin = papel === "admin";

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Manual do sistema
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          As seções abaixo mostram apenas o que se aplica ao seu perfil de
          acesso.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <ManualNav papel={papel as Papel} />

        <div>
          <SecaoPrimeirosPassos />
          <SecaoConsulta />
          <SecaoImportacao />
          <SecaoCadastros />
          {isAdmin && <SecaoAdministracao />}
          <SecaoReferencia />
        </div>
      </div>
    </main>
  );
}
