import { redirect } from "next/navigation";
import Link from "next/link";
import { getMeuPapel } from "@/lib/auth/guards";
import { EstacionamentoForm } from "@/features/cadastros/components/estacionamento-form";

export default async function NovoEstacionamentoPage() {
  const papel = await getMeuPapel();
  if (papel !== "admin") redirect("/cadastros/estacionamentos");

  return (
    <main className="mx-auto max-w-[1800px] space-y-4 px-6 py-6">
      <Link
        href="/cadastros/estacionamentos"
        className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
      >
        ← Voltar para estacionamentos
      </Link>
      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">
          Novo estacionamento
        </h2>
        <EstacionamentoForm />
      </section>
    </main>
  );
}
