import { redirect } from "next/navigation";
import { requireAutenticado, getMeuPapel } from "@/lib/auth/guards";
import { logout } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";

export default async function SemAcessoPage() {
  await requireAutenticado();
  const papel = await getMeuPapel();

  if (papel) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Acesso pendente
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Sua conta ainda não tem um papel definido neste sistema. Peça a um
          administrador para liberar seu acesso.
        </p>
        <form action={logout} className="mt-6">
          <Button type="submit" variant="secondary" fullWidth>
            Sair
          </Button>
        </form>
      </div>
    </main>
  );
}
