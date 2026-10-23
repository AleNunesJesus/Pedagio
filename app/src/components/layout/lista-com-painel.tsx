import Link from "next/link";
import { formatNumber } from "@/lib/format";

type ListaComPainelProps = {
  titulo: string;
  total: number;
  // ex.: "viagem(ns)"
  unidade: string;
  erro?: string | null;
  // busca do cabeçalho, ligada ao form de filtros pelo id
  busca?: { formId: string; valor?: string; placeholder: string };
  // ações do cabeçalho (ex.: botão "Nova praça")
  acoes?: React.ReactNode;
  // lateral de filtros; sem ela (cadastros simples) a busca usa um form oculto
  filtros?: React.ReactNode;
  children: React.ReactNode;
  // painel da direita; undefined = tela sem painel de detalhe
  detalhe?: React.ReactNode;
};

// Estrutura das listas no layout novo (FASE 26, Modelo 3): cabeçalho com
// título, total e busca; filtros fixos à esquerda; lista no meio; painel de
// detalhe do item selecionado à direita (desce para baixo da lista em
// telas menores)
export function ListaComPainel({
  titulo,
  total,
  unidade,
  erro,
  busca,
  acoes,
  filtros,
  children,
  detalhe,
}: ListaComPainelProps) {
  const comDetalhe = detalhe !== undefined;
  const comFiltros = filtros !== undefined;
  const colunas = comFiltros
    ? `lg:grid-cols-[260px_minmax(0,1fr)] ${comDetalhe ? "xl:grid-cols-[260px_minmax(0,1fr)_380px]" : ""}`
    : comDetalhe
      ? "lg:grid-cols-[minmax(0,1fr)_380px]"
      : "";
  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center gap-4 border-b border-gray-200 bg-white px-6 py-3.5 dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{titulo}</h1>
        {erro ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            Não foi possível carregar a lista ({erro}). Tente novamente.
          </p>
        ) : (
          <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-sm font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            {formatNumber(total)} {unidade}
          </span>
        )}
        <div className="flex w-full flex-wrap items-center gap-3 sm:ml-auto sm:w-auto">
          {busca && (
            <label className="flex h-10 w-full items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm text-gray-600 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 sm:w-80 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden className="h-4 w-4 shrink-0">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                type="search"
                name="busca"
                form={busca.formId}
                defaultValue={busca.valor ?? ""}
                aria-label={busca.placeholder}
                placeholder={busca.placeholder}
                className="min-w-0 flex-1 bg-transparent text-gray-900 outline-none placeholder:text-gray-500 dark:text-gray-100"
              />
            </label>
          )}
          {acoes}
        </div>
        {busca && !comFiltros && <form id={busca.formId} method="get" className="hidden" />}
      </header>

      <div className={`grid flex-1 ${colunas}`}>
        {comFiltros && (
          <aside className="border-b border-gray-200 bg-white p-5 lg:border-b-0 lg:border-r dark:border-gray-800 dark:bg-gray-900">
            {filtros}
          </aside>
        )}

        <section className="min-w-0 p-5">
          <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
            {children}
          </div>
        </section>

        {comDetalhe && (
          <aside
            className={`border-t border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 ${
              comFiltros
                ? "lg:col-span-2 xl:col-span-1 xl:border-l xl:border-t-0"
                : "lg:border-l lg:border-t-0"
            }`}
          >
            {detalhe}
          </aside>
        )}
      </div>
    </main>
  );
}

// painel da direita com um formulário de criação (cadastros)
export function PainelNovo({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{titulo}</h2>
      {descricao && <div className="text-sm text-gray-600 dark:text-gray-400">{descricao}</div>}
      {children}
    </div>
  );
}

// conteúdo do painel quando nada está selecionado
export function DetalheVazio({ icone, children }: { icone: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-center text-sm text-gray-600 dark:text-gray-400">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-8 w-8 text-gray-400">
        <path d={icone} />
      </svg>
      {children}
    </div>
  );
}

// botão "X" do painel de detalhe
export function FecharDetalhe({ href }: { href: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-label="Fechar detalhe"
      className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden className="h-4 w-4">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </Link>
  );
}
