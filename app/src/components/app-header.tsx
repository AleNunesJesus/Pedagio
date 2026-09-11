import Link from "next/link";
import { logout } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";

export function AppHeader({ papel }: { papel: string }) {
  return (
    <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-gray-900 dark:text-gray-100">Pedágio</span>
          <nav className="flex gap-4 text-sm">
            <Link
              href="/dashboard"
              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              Painel
            </Link>
            <Link
              href="/cadastros/categorias"
              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              Cadastros
            </Link>
            <Link
              href="/importacao"
              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              Importação
            </Link>
            <Link
              href="/passagens"
              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              Passagens
            </Link>
            <Link
              href="/rastreamento"
              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              Rastreamento
            </Link>
            {papel === "admin" && (
              <Link
                href="/usuarios"
                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                Usuários
              </Link>
            )}
          </nav>
        </div>
        <form action={logout}>
          <Button type="submit" variant="ghost" size="sm">
            Sair
          </Button>
        </form>
      </div>
    </header>
  );
}
