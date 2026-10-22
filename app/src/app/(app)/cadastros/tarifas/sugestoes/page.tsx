import Link from "next/link";
import { getMeuPapel } from "@/lib/auth/guards";
import { listSugestoesTarifa, getPeriodoPassagens } from "@/features/cadastros/queries";
import { GerarSugestoesForm } from "@/features/cadastros/components/gerar-sugestoes-form";
import { SugestoesTarifaList } from "@/features/cadastros/components/sugestoes-tarifa-list";
import { formatNumber } from "@/lib/format";

const FILTROS = [
  { valor: "concordam", label: "Fatura e OSM concordam" },
  { valor: "divergem", label: "Divergem" },
  { valor: "sem_osm", label: "Sem OSM" },
  { valor: "todas", label: "Todas" },
] as const;

type Filtro = (typeof FILTROS)[number]["valor"];

export default async function SugestoesTarifaPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { filtro: filtroParam } = await searchParams;
  const filtro: Filtro = FILTROS.some((f) => f.valor === filtroParam) ? (filtroParam as Filtro) : "concordam";

  const [sugestoes, papel, periodo] = await Promise.all([
    listSugestoesTarifa(),
    getMeuPapel(),
    getPeriodoPassagens(),
  ]);

  const situacao = (s: (typeof sugestoes)[number]): Filtro =>
    s.valor_eixo_osm === null ? "sem_osm" : s.fontes_concordam ? "concordam" : "divergem";
  const contagem = (f: Filtro) => (f === "todas" ? sugestoes.length : sugestoes.filter((s) => situacao(s) === f).length);
  const rows = filtro === "todas" ? sugestoes : sugestoes.filter((s) => situacao(s) === filtro);

  return (
    <div className="space-y-6">
      <Link
        href="/cadastros/tarifas"
        className="text-sm text-blue-600 hover:underline dark:text-blue-400"
      >
        ← Voltar para tarifas
      </Link>

      <section className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
        <h2 className="text-base font-medium text-gray-900 dark:text-gray-100">Sugestões de tarifa</h2>
        <p>
          Para cada praça sem tarifa no período, o valor por eixo que explica o maior número de
          débitos das faturas (todos os eixos ou eixos suspensos, com ou sem 5% de TAG), comparado
          com a tarifa publicada no OpenStreetMap. Aprovar grava a tarifa a partir do início do
          período e revalida as passagens da praça.
        </p>
        <p className="text-xs">
          Tarifas do OpenStreetMap: ©{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            colaboradores do OpenStreetMap
          </a>{" "}
          (ODbL) — mantidas por voluntários, podem estar desatualizadas.
        </p>
      </section>

      {papel === "admin" && (
        <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-1 text-sm font-medium text-gray-900 dark:text-gray-100">
            Gerar sugestões
          </h3>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            Refaz todas as sugestões pendentes a partir dos débitos do período.
          </p>
          <GerarSugestoesForm inicio={periodo.inicio} fim={periodo.fim} />
        </section>
      )}

      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <nav className="flex flex-wrap gap-2 text-sm">
          {FILTROS.map((f) => (
            <Link
              key={f.valor}
              href={`/cadastros/tarifas/sugestoes?filtro=${f.valor}`}
              className={
                f.valor === filtro
                  ? "rounded-md bg-gray-900 px-3 py-1 text-white dark:bg-gray-100 dark:text-gray-900"
                  : "rounded-md px-3 py-1 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              }
            >
              {f.label} ({formatNumber(contagem(f.valor))})
            </Link>
          ))}
        </nav>
        <SugestoesTarifaList key={filtro} rows={rows} isAdmin={papel === "admin"} />
      </section>
    </div>
  );
}
