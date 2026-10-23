import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";

// Form GET da lateral de filtros; a busca do cabeçalho (ListaComPainel)
// aponta para ele pelo mesmo id via atributo form=""
export function PainelFiltros({
  id,
  limparHref,
  children,
}: {
  id: string;
  limparHref: string;
  children: React.ReactNode;
}) {
  return (
    <form id={id} method="get" className="space-y-6">
      <p className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">Filtros</p>
      {children}
      <div className="space-y-2">
        <Button type="submit" fullWidth>
          Aplicar filtros
        </Button>
        <Link
          href={limparHref}
          className="block text-center text-sm text-gray-600 hover:underline dark:text-gray-400"
        >
          Limpar filtros
        </Link>
      </div>
    </form>
  );
}

export type OpcaoRadio = {
  value: string;
  label: string;
  // quantos itens a opção traria com os demais filtros atuais
  qtd?: number;
  // classes de cor do número (ex.: vermelho para problema)
  corQtd?: string;
  // bolinha de cor antes do rótulo (ex.: cor do status)
  cor?: string;
};

export function GrupoRadio({
  legenda,
  name,
  valor,
  opcoes,
}: {
  legenda: string;
  name: string;
  valor: string;
  opcoes: OpcaoRadio[];
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">{legenda}</legend>
      {opcoes.map((o) => (
        <label
          key={o.value}
          className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            defaultChecked={valor === o.value}
            className="h-4 w-4 shrink-0 accent-indigo-700"
          />
          {o.cor && (
            <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: o.cor }} />
          )}
          <span className="min-w-0">{o.label}</span>
          {o.qtd !== undefined && (
            <span className={`ml-auto text-xs tabular-nums ${o.corQtd ?? "text-gray-500 dark:text-gray-400"}`}>
              {formatNumber(o.qtd)}
            </span>
          )}
        </label>
      ))}
    </fieldset>
  );
}
