"use client";

import { useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { importarViagensTransporte, type ImportacaoState } from "../actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { formatNumber } from "@/lib/format";

const initialState: ImportacaoState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Importando..." : "Importar"}
    </Button>
  );
}

export function ImportarViagensForm() {
  const [state, formAction] = useActionState(importarViagensTransporte, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.lote) formRef.current?.reset();
  }, [state.lote]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div>
        <label
          htmlFor="arquivo-viagens"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Arquivo CSV
        </label>
        <input
          id="arquivo-viagens"
          name="arquivo"
          type="file"
          accept=".csv,text/csv"
          required
          className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200 dark:text-gray-300 dark:file:bg-gray-800 dark:file:text-gray-300"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Cabeçalhos esperados: placa, numero_transporte, cidade_origem,
          uf_origem, cidade_destino, uf_destino, data_hora_saida,
          data_hora_chegada (DD/MM/AAAA HH24:MI), carreta1, carreta2,
          tipo_viagem (carregado/vazio). O embarcador é descoberto
          cruzando com as passagens de pedágio do período. Veja
          docs/importacao.md.
        </p>
      </div>

      <SubmitButton />

      {state.error && <FormMessage type="error">{state.error}</FormMessage>}

      {state.lote && (
        <FormMessage type="success">
          Lote importado: {formatNumber(state.lote.total_linhas)} linha(s),{" "}
          {formatNumber(state.lote.total_erros)} erro(s).
        </FormMessage>
      )}
    </form>
  );
}
