"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/features/auth/actions";
import { ThemeToggle } from "@/components/theme-toggle";

type SubItem = { href: string; label: string };

type Item = {
  label: string;
  icone: string;
  href?: string;
  // grupos abrem um submenu ao lado; o item fica ativo se a rota casar com algum filho
  filhos?: SubItem[];
};

// traços de 24×24 desenhados com stroke (sem preenchimento)
const ICONES = {
  painel: "M4 13h6V4H4zM14 20h6v-9h-6zM14 4v4h6V4zM4 20h6v-4H4z",
  viagens: "M3 17h2l1-5h11l2 5h2M7 17a2 2 0 1 0 0 .01M17 17a2 2 0 1 0 0 .01M6 12l2-5h8l2 5",
  faturas: "M7 3h10v18l-3-2-2 2-2-2-3 2zM10 8h4M10 12h4",
  mapa: "M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14",
  importar: "M12 3v12M7 10l5 5 5-5M4 21h16",
  cadastros: "M4 6h16M4 12h16M4 18h10",
  sistema: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12h2M3 12h2M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4",
};

function montarItens(papel: string): Item[] {
  return [
    { label: "Painel", icone: ICONES.painel, href: "/dashboard" },
    { label: "Viagens", icone: ICONES.viagens, href: "/viagens-transporte" },
    {
      label: "Faturamento",
      icone: ICONES.faturas,
      filhos: [
        { href: "/faturas", label: "Faturas" },
        { href: "/passagens", label: "Passagens" },
        { href: "/credito-debito", label: "Crédito / Débito" },
      ],
    },
    { label: "Mapa", icone: ICONES.mapa, href: "/rastreamento" },
    { label: "Importar", icone: ICONES.importar, href: "/importacao" },
    {
      label: "Cadastros",
      icone: ICONES.cadastros,
      filhos: [
        { href: "/cadastros/pracas", label: "Praças" },
        { href: "/cadastros/tarifas", label: "Tarifas" },
        { href: "/cadastros/tarifas/sugestoes", label: "Sugestões de tarifa" },
        { href: "/cadastros/veiculos", label: "Veículos" },
        { href: "/cadastros/categorias", label: "Categorias" },
        { href: "/cadastros/embarcadores", label: "Embarcadores" },
        { href: "/cadastros/estacionamentos", label: "Estacionamentos" },
        { href: "/cadastros/tarifas-estacionamento", label: "Tarifas estacionamento" },
      ],
    },
    {
      label: "Sistema",
      icone: ICONES.sistema,
      filhos: [
        ...(papel === "admin" ? [{ href: "/usuarios", label: "Usuários" }] : []),
        { href: "/manual", label: "Manual" },
      ],
    },
  ];
}

// "/cadastros/tarifas" não deve acender junto com "/cadastros/tarifas/sugestoes":
// vale o href mais longo que casar com a rota
function hrefAtivo(pathname: string, hrefs: string[]) {
  return hrefs
    .filter((h) => pathname === h || pathname.startsWith(`${h}/`))
    .sort((a, b) => b.length - a.length)[0];
}

function Icone({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-5 w-5"
    >
      <path d={d} />
    </svg>
  );
}

const ITEM_BASE =
  "flex w-[68px] flex-col items-center gap-1 rounded-lg py-2 text-[11px] leading-tight transition-colors";
const ITEM_ATIVO = "bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300";
const ITEM_INATIVO =
  "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100";

function Grupo({ item, ativoHref }: { item: Item; ativoHref?: string }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const ativo = item.filhos!.some((f) => f.href === ativoHref);

  useEffect(() => {
    if (!aberto) return;
    function fora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setAberto(true)}
      onMouseLeave={() => setAberto(false)}
    >
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className={`${ITEM_BASE} ${ativo ? ITEM_ATIVO : ITEM_INATIVO}`}
      >
        <Icone d={item.icone} />
        {item.label}
      </button>
      {aberto && (
        // pl-2 em vez de margem: mantém o hover contínuo entre o botão e o painel
        <div className="absolute left-0 top-full z-30 pt-1 md:left-full md:top-0 md:pl-2 md:pt-0">
          <div className="min-w-52 rounded-lg border border-gray-200 bg-white py-2 shadow-lg dark:border-gray-800 dark:bg-gray-900">
            <p className="px-4 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {item.label}
            </p>
            {item.filhos!.map((f) => (
              <Link
                key={f.href}
                href={f.href}
                onClick={() => setAberto(false)}
                className={`block px-4 py-2 text-sm ${
                  f.href === ativoHref
                    ? "bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                    : "text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AppSidebar({ papel }: { papel: string }) {
  const pathname = usePathname();
  const itens = montarItens(papel);
  const ativoHref = hrefAtivo(
    pathname,
    itens.flatMap((i) => (i.filhos ? i.filhos.map((f) => f.href) : [i.href!])),
  );

  return (
    <nav
      aria-label="Menu principal"
      className="z-20 flex flex-wrap items-center gap-1 border-b border-gray-200 bg-white px-2 py-2 md:sticky md:top-0 md:h-screen md:w-[84px] md:shrink-0 md:flex-col md:flex-nowrap md:border-b-0 md:border-r md:px-0 md:py-4 dark:border-gray-800 dark:bg-gray-900"
    >
      <Link
        href="/dashboard"
        aria-label="Pedágio — início"
        className="mr-2 flex h-9 w-9 items-center justify-center rounded-[10px] bg-indigo-700 text-white md:mb-3 md:mr-0"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden className="h-5 w-5">
          <path d="M3 20h18M5 20V9l7-5 7 5v11M9 20v-6h6v6" />
        </svg>
      </Link>

      {itens.map((item) =>
        item.filhos ? (
          <Grupo key={item.label} item={item} ativoHref={ativoHref} />
        ) : (
          <Link
            key={item.href}
            href={item.href!}
            aria-current={item.href === ativoHref ? "page" : undefined}
            className={`${ITEM_BASE} ${item.href === ativoHref ? ITEM_ATIVO : ITEM_INATIVO}`}
          >
            <Icone d={item.icone} />
            {item.label}
          </Link>
        ),
      )}

      <div className="ml-auto flex items-center gap-1 md:ml-0 md:mt-auto md:flex-col">
        <ThemeToggle />
        <form action={logout}>
          <button
            type="submit"
            className={`${ITEM_BASE} ${ITEM_INATIVO}`}
          >
            <Icone d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
            Sair
          </button>
        </form>
      </div>
    </nav>
  );
}
