import Link from "next/link";

const ABAS = [
  { href: "/cadastros/categorias", label: "Categorias" },
  { href: "/cadastros/veiculos", label: "Veículos" },
  { href: "/cadastros/pracas", label: "Praças" },
  { href: "/cadastros/tarifas", label: "Tarifas" },
  { href: "/cadastros/embarcadores", label: "Embarcadores" },
];

export default function CadastrosLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Cadastros</h1>
      <nav className="mt-4 flex gap-4 border-b border-gray-200 text-sm dark:border-gray-800">
        {ABAS.map((aba) => (
          <Link
            key={aba.href}
            href={aba.href}
            className="border-b-2 border-transparent px-1 py-2 text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            {aba.label}
          </Link>
        ))}
      </nav>
      <div className="mt-6">{children}</div>
    </main>
  );
}
