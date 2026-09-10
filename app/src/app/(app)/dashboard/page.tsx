import { createClient } from "@/lib/supabase/server";

// Placeholder da FASE 06.2 (scaffold + login) — só prova que autenticação,
// RLS e o cliente Supabase apontando para o schema `pedagio` funcionam de
// ponta a ponta. O dashboard de indicadores de verdade vem na FASE 06.3.
export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ count: pracas }, { count: veiculos }, { data: statusResumo }] =
    await Promise.all([
      supabase.from("praca_pedagio").select("*", { count: "exact", head: true }),
      supabase.from("veiculo").select("*", { count: "exact", head: true }),
      supabase.from("vw_status_resumo").select("*"),
    ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
        Painel
      </h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Login e conexão com o schema <code>pedagio</code> funcionando. O
        dashboard de indicadores (FASE 06.3) ainda não foi construído.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">Praças cadastradas</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {pracas ?? 0}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">Veículos cadastrados</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {veiculos ?? 0}
          </p>
        </div>
      </div>

      <h2 className="mt-8 text-sm font-medium text-gray-700 dark:text-gray-300">
        Passagens por status (vw_status_resumo)
      </h2>
      {statusResumo && statusResumo.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
          {statusResumo.map((linha) => (
            <li key={linha.status_validacao}>
              {linha.status_validacao}: {linha.qtd} ({linha.percentual}%)
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Nenhuma passagem importada ainda.
        </p>
      )}
    </main>
  );
}
