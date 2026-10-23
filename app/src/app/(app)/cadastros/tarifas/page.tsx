import Link from "next/link";
import { getMeuPapel } from "@/lib/auth/guards";
import { listTarifas, listPracas, contarSugestoesTarifaPendentes } from "@/features/cadastros/queries";
import { TarifaForm } from "@/features/cadastros/components/tarifa-form";
import { TarifaList } from "@/features/cadastros/components/tarifa-list";
import { formatNumber } from "@/lib/format";

export default async function TarifasPage() {
  const [tarifas, pracas, sugestoesPendentes, papel] = await Promise.all([
    listTarifas(),
    listPracas(),
    contarSugestoesTarifaPendentes(),
    getMeuPapel(),
  ]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        A tarifa é o valor por eixo da praça. A validação aceita a cobrança de todos os eixos da
        composição ou de menos eixos (eixos suspensos), com ou sem 5% de desconto de TAG.{" "}
        <Link
          href="/cadastros/tarifas/sugestoes"
          className="text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Sugestões de tarifa
          {sugestoesPendentes > 0 && ` (${formatNumber(sugestoesPendentes)} pendentes)`}
        </Link>
      </p>
      {papel === "admin" && (
        <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">
            Nova tarifa
          </h2>
          {pracas.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Cadastre ao menos uma praça antes de definir tarifas.
            </p>
          ) : (
            <TarifaForm pracas={pracas} />
          )}
        </section>
      )}
      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <TarifaList rows={tarifas} isAdmin={papel === "admin"} />
      </section>
    </div>
  );
}
