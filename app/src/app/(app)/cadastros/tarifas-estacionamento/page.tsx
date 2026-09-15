import { getMeuPapel } from "@/lib/auth/guards";
import { listTarifasEstacionamento, listEstacionamentos } from "@/features/cadastros/queries";
import { TarifaEstacionamentoForm } from "@/features/cadastros/components/tarifa-estacionamento-form";
import { TarifaEstacionamentoList } from "@/features/cadastros/components/tarifa-estacionamento-list";

export default async function TarifasEstacionamentoPage() {
  const [tarifas, estacionamentos, papel] = await Promise.all([
    listTarifasEstacionamento(),
    listEstacionamentos(),
    getMeuPapel(),
  ]);

  return (
    <div className="space-y-6">
      {papel === "admin" && (
        <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">
            Nova tarifa
          </h2>
          {estacionamentos.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Cadastre ao menos um estacionamento antes de definir tarifas.
            </p>
          ) : (
            <TarifaEstacionamentoForm estacionamentos={estacionamentos} />
          )}
        </section>
      )}
      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <TarifaEstacionamentoList rows={tarifas} isAdmin={papel === "admin"} />
      </section>
    </div>
  );
}
