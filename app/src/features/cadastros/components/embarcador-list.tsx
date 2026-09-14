"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { atualizarEmbarcadorCnpj, excluirEmbarcadores, type FormState } from "../actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { EmptyState } from "@/components/ui/card";

type Embarcador = { id: string; nome: string; cnpj: string | null };

const initialState: FormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="secondary" disabled={pending}>
      {pending ? "Salvando..." : "Salvar"}
    </Button>
  );
}

function ExcluirButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  function excluir() {
    if (!window.confirm("Excluir este embarcador? Essa ação não pode ser desfeita.")) return;
    setErro(null);
    startTransition(async () => {
      const resultado = await excluirEmbarcadores([id]);
      if (resultado.error) {
        setErro(resultado.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" size="sm" variant="destructive" disabled={pending} onClick={excluir}>
        {pending ? "Excluindo..." : "Excluir"}
      </Button>
      {erro && <span className="text-xs text-red-600 dark:text-red-400">{erro}</span>}
    </div>
  );
}

function EmbarcadorRow({ embarcador }: { embarcador: Embarcador }) {
  const [state, formAction] = useActionState(atualizarEmbarcadorCnpj, initialState);

  return (
    <tr className="border-b border-gray-100 last:border-0 dark:border-gray-900">
      <td className="py-2 text-gray-900 dark:text-gray-100">{embarcador.nome}</td>
      <td className="py-2">
        <form action={formAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={embarcador.id} />
          <input
            name="cnpj"
            defaultValue={embarcador.cnpj ?? ""}
            placeholder="00.000.000/0000-00"
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <SubmitButton />
          {state.error && <FormMessage type="error">{state.error}</FormMessage>}
          {state.success && (
            <span className="text-xs text-green-600 dark:text-green-400">Salvo</span>
          )}
        </form>
      </td>
      <td className="py-2">
        <ExcluirButton id={embarcador.id} />
      </td>
    </tr>
  );
}

export function EmbarcadorList({
  rows,
  podeEditar,
}: {
  rows: Embarcador[];
  podeEditar: boolean;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState>
        Nenhum embarcador cadastrado ainda — aparecem automaticamente ao
        importar passagens com esse dado.
      </EmptyState>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <th className="py-2 font-medium">Nome</th>
            <th className="py-2 font-medium">CNPJ</th>
            {podeEditar && <th className="py-2 font-medium">Ações</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((embarcador) =>
            podeEditar ? (
              <EmbarcadorRow key={embarcador.id} embarcador={embarcador} />
            ) : (
              <tr
                key={embarcador.id}
                className="border-b border-gray-100 last:border-0 dark:border-gray-900"
              >
                <td className="py-2 text-gray-900 dark:text-gray-100">{embarcador.nome}</td>
                <td className="py-2 text-gray-900 dark:text-gray-100">
                  {embarcador.cnpj ?? "—"}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}
