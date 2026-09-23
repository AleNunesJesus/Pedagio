import Link from "next/link";
import type { Papel } from "@/features/manual/tipos";

type NavItem = { href: string; label: string };
type NavGroup = { label: string; perfis: Papel[]; items: NavItem[] };

const GRUPOS: NavGroup[] = [
  {
    label: "Primeiros passos",
    perfis: ["admin", "operador"],
    items: [
      { href: "#entrar", label: "Entrar no sistema" },
      { href: "#como-funciona", label: "Como o sistema funciona" },
      { href: "#acesso-pendente", label: "Acesso pendente" },
      { href: "#papeis", label: "Papéis de acesso" },
      { href: "#convencoes", label: "Convenções gerais" },
    ],
  },
  {
    label: "Consulta e conciliação",
    perfis: ["admin", "operador"],
    items: [
      { href: "#painel", label: "Painel" },
      { href: "#faturas", label: "Faturas" },
      { href: "#passagens", label: "Passagens" },
      { href: "#credito-debito", label: "Crédito x débito" },
      { href: "#viagens", label: "Viagens" },
      { href: "#rastreamento", label: "Rastreamento" },
    ],
  },
  {
    label: "Importação",
    perfis: ["admin", "operador"],
    items: [
      { href: "#importar-passagens", label: "Importar passagens" },
      { href: "#importar-gps", label: "Importar posições de GPS" },
      { href: "#importar-viagens", label: "Importar viagens (doc. fiscal)" },
      { href: "#historico-importacoes", label: "Histórico de importações" },
    ],
  },
  {
    label: "Cadastros",
    perfis: ["admin", "operador"],
    items: [
      { href: "#cadastros-categorias", label: "Categorias" },
      { href: "#cadastros-veiculos", label: "Veículos" },
      { href: "#cadastros-pracas", label: "Praças" },
      { href: "#cadastros-tarifas", label: "Tarifas" },
      { href: "#cadastros-estacionamentos", label: "Estacionamentos" },
      { href: "#cadastros-tarifas-estacionamento", label: "Tarifas estacionamento" },
      { href: "#cadastros-embarcadores", label: "Embarcadores" },
    ],
  },
  {
    label: "Administração",
    perfis: ["admin"],
    items: [{ href: "#usuarios", label: "Usuários" }],
  },
  {
    label: "Referência rápida",
    perfis: ["admin", "operador"],
    items: [
      { href: "#fluxo-validacao", label: "Fluxo geral" },
      { href: "#status-validacao", label: "Status de validação" },
      { href: "#valor-sinalizado", label: "Valor sinalizado" },
      { href: "#permissoes", label: "Quem pode fazer o quê" },
    ],
  },
];

export function ManualNav({ papel }: { papel: Papel }) {
  const grupos = GRUPOS.filter((grupo) => grupo.perfis.includes(papel));

  return (
    <nav className="space-y-6 lg:sticky lg:top-6">
      {grupos.map((grupo) => (
        <div key={grupo.label}>
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {grupo.label}
          </p>
          <ul className="space-y-0.5">
            {grupo.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-md px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
