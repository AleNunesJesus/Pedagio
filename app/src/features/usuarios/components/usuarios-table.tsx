"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { salvarPapel, type FormState } from "../actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import type { Usuario } from "../queries";

const initialState: FormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="secondary" disabled={pending}>
      {pending ? "Salvando..." : "Salvar"}
    </Button>
  );
}

function UsuarioRow({ usuario, souEu }: { usuario: Usuario; souEu: boolean }) {
  const [state, formAction] = useActionState(salvarPapel, initialState);

  return (
    <tr className="border-b border-gray-100 last:border-0 dark:border-gray-900">
      <td className="py-2 text-gray-700 dark:text-gray-300">
        {usuario.email ?? "—"}
        {souEu && <span className="ml-2 text-xs text-gray-400">(você)</span>}
      </td>
      <td className="py-2">
        <form action={formAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="user_id" value={usuario.user_id} />
          <select
            name="papel"
            defaultValue={usuario.papel ?? "sem_acesso"}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <option value="sem_acesso">Sem acesso</option>
            <option value="operador">Operador</option>
            <option value="admin">Admin</option>
          </select>
          <SubmitButton />
          {state.error && <FormMessage type="error">{state.error}</FormMessage>}
          {state.success && (
            <span className="text-xs text-green-600 dark:text-green-400">Salvo</span>
          )}
        </form>
      </td>
    </tr>
  );
}

export function UsuariosTable({ rows, meuUserId }: { rows: Usuario[]; meuUserId: string }) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
        Nenhum usuário encontrado.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <th className="py-2 font-medium">E-mail</th>
            <th className="py-2 font-medium">Papel</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((usuario) => (
            <UsuarioRow
              key={usuario.user_id}
              usuario={usuario}
              souEu={usuario.user_id === meuUserId}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
