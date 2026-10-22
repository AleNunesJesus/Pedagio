import Link from "next/link";
import { logout } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { NavDropdown } from "@/components/nav-dropdown";

const FATURAS_ITEMS = [
  { href: "/faturas", label: "Faturas" },
  { href: "/passagens", label: "Passagens" },
  { href: "/credito-debito", label: "Crédito/Débito" },
];

const CADASTROS_ITEMS = [
  { href: "/cadastros/categorias", label: "Categorias" },
  { href: "/cadastros/veiculos", label: "Veículos" },
  { href: "/cadastros/pracas", label: "Praças" },
  { href: "/cadastros/tarifas", label: "Tarifas" },
  { href: "/cadastros/tarifas/sugestoes", label: "Sugestões de tarifa" },
  { href: "/cadastros/estacionamentos", label: "Estacionamentos" },
  { href: "/cadastros/tarifas-estacionamento", label: "Tarifas estacionamento" },
  { href: "/cadastros/embarcadores", label: "Embarcadores" },
];

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
            <NavDropdown label="Faturas" items={FATURAS_ITEMS} />
            <Link
              href="/viagens-transporte"
              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              Viagens
            </Link>
            <Link
              href="/rastreamento"
              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              Rastreamento
            </Link>
            <Link
              href="/importacao"
              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              Importação
            </Link>
            <NavDropdown label="Cadastros" items={CADASTROS_ITEMS} />
            {papel === "admin" && (
              <Link
                href="/usuarios"
                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                Usuários
              </Link>
            )}
            <Link
              href="/manual"
              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            >
              Manual
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <form action={logout}>
            <Button type="submit" variant="ghost" size="sm">
              Sair
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
