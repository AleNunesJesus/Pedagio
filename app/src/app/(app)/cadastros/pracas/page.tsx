import { getMeuPapel } from "@/lib/auth/guards";
import { listPracas } from "@/features/cadastros/queries";
import { PracaList } from "@/features/cadastros/components/praca-list";
import { LinkButton } from "@/components/ui/button";

export default async function PracasPage() {
  const [pracas, papel] = await Promise.all([listPracas(), getMeuPapel()]);

  return (
    <div className="space-y-6">
      {papel === "admin" && (
        <div className="flex justify-end">
          <LinkButton href="/cadastros/pracas/nova">Nova praça</LinkButton>
        </div>
      )}
      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <PracaList rows={pracas} podeEditar={papel === "admin"} />
      </section>
    </div>
  );
}
