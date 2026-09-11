import { redirect } from "next/navigation";
import { getMeuPapel } from "@/lib/auth/guards";
import { PracaForm } from "@/features/cadastros/components/praca-form";

export default async function NovaPracaPage() {
  const papel = await getMeuPapel();
  if (papel !== "admin") redirect("/cadastros/pracas");

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">
        Nova praça
      </h2>
      <PracaForm />
    </section>
  );
}
