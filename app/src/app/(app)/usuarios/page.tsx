import { requireAdmin } from "@/lib/auth/guards";
import { listUsuarios } from "@/features/usuarios/queries";
import { UsuariosTable } from "@/features/usuarios/components/usuarios-table";

export default async function UsuariosPage() {
  const { claims } = await requireAdmin();
  const usuarios = await listUsuarios();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Usuários</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Defina o papel de cada usuário autenticado: <strong>admin</strong> tem acesso
        total; <strong>operador</strong> só consulta e importa planilhas, sem editar
        cadastros/tarifas; <strong>sem acesso</strong> bloqueia o sistema inteiro.
      </p>
      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <UsuariosTable rows={usuarios} meuUserId={claims.sub as string} />
      </section>
    </main>
  );
}
