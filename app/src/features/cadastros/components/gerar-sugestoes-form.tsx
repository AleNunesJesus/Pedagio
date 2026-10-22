"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { gerarSugestoesTarifa, type GerarSugestoesState } from "../actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { TextField } from "@/components/ui/field";
import { formatNumber } from "@/lib/format";

const initialState: GerarSugestoesState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Gerando..." : "Gerar sugestões"}
    </Button>
  );
}

export function GerarSugestoesForm({ inicio, fim }: { inicio: string; fim: string }) {
  const [state, formAction] = useActionState(gerarSugestoesTarifa, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <TextField
        id="inicio"
        name="inicio"
        label="Passagens de"
        type="date"
        required
        defaultValue={state.inicio ?? inicio}
      />
      <TextField
        id="fim"
        name="fim"
        label="até"
        type="date"
        required
        defaultValue={state.fim ?? fim}
      />
      <SubmitButton />
      {state.error && <FormMessage type="error">{state.error}</FormMessage>}
      {state.success && (
        <span className="text-sm text-green-600 dark:text-green-400">
          {formatNumber(state.geradas)} sugestão(ões) gerada(s).
        </span>
      )}
    </form>
  );
}
