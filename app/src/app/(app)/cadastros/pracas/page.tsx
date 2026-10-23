import Link from "next/link";
import { getMeuPapel } from "@/lib/auth/guards";
import { listPracas } from "@/features/cadastros/queries";
import { PracaList } from "@/features/cadastros/components/praca-list";
import { LinkButton } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { formatNumber } from "@/lib/format";

const SEM_UF = "sem";

export default async function PracasPage({
  searchParams,
}: {
  searchParams: Promise<{ uf?: string }>;
}) {
  const [{ uf: ufParam }, pracas, papel] = await Promise.all([searchParams, listPracas(), getMeuPapel()]);
  const pendentes = pracas.filter((p) => p.cadastro_pendente).length;

  // filtro por UF só com as UFs que existem no cadastro
  const contagemUf = new Map<string, number>();
  for (const p of pracas) {
    const chave = p.uf ?? SEM_UF;
    contagemUf.set(chave, (contagemUf.get(chave) ?? 0) + 1);
  }
  const ufs = [...contagemUf.keys()].filter((u) => u !== SEM_UF).sort();
  if (contagemUf.has(SEM_UF)) ufs.push(SEM_UF);
  const filtro = ufParam && contagemUf.has(ufParam) ? ufParam : null;
  const rows = filtro ? pracas.filter((p) => (p.uf ?? SEM_UF) === filtro) : pracas;

  const classeFiltro = (ativo: boolean) =>
    ativo
      ? "rounded-md bg-gray-900 px-2.5 py-1 text-white dark:bg-gray-100 dark:text-gray-900"
      : "rounded-md px-2.5 py-1 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800";

  return (
    <div className="space-y-6">
      {papel === "admin" && (
        <div className="flex justify-end">
          <LinkButton href="/cadastros/pracas/nova">Nova praça</LinkButton>
        </div>
      )}
      {pendentes > 0 && (
        <Alert variant="warning">
          {formatNumber(pendentes)} praça(s) criada(s) automaticamente pela importação da fatura,
          só com nome e sentido da planilha. Até o polígono ser desenhado, as passagens dessas
          praças ficam como &quot;Sem cadastro&quot;.{" "}
          {papel === "admin"
            ? "Abra cada uma para completar o cadastro — a busca \"Localizar no mapa\" e as cabines do OpenStreetMap ajudam a achar o local; ao salvar, as passagens são revalidadas."
            : "Peça a um administrador para completar o cadastro."}
        </Alert>
      )}
      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        {ufs.length > 1 && (
          <nav aria-label="Filtrar por UF" className="flex flex-wrap gap-1 text-sm">
            <Link href="/cadastros/pracas" className={classeFiltro(filtro === null)}>
              Todas ({formatNumber(pracas.length)})
            </Link>
            {ufs.map((u) => (
              <Link key={u} href={`/cadastros/pracas?uf=${u}`} className={classeFiltro(filtro === u)}>
                {u === SEM_UF ? "Sem UF" : u} ({formatNumber(contagemUf.get(u) ?? 0)})
              </Link>
            ))}
          </nav>
        )}
        <PracaList rows={rows} isAdmin={papel === "admin"} />
      </section>
    </div>
  );
}
