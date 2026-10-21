"use client";

import { useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { importarPlanilha, type ImportacaoState } from "../actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Alert } from "@/components/ui/alert";
import Link from "next/link";
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

export function ImportarForm() {
  const [state, formAction] = useActionState(importarPlanilha, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.lote) formRef.current?.reset();
  }, [state.lote]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div>
        <label
          htmlFor="arquivo"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Arquivo CSV
        </label>
        <input
          id="arquivo"
          name="arquivo"
          type="file"
          accept=".csv,text/csv"
          required
          className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200 dark:text-gray-300 dark:file:bg-gray-800 dark:file:text-gray-300"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Cabeçalhos esperados, nesta ordem: Número da Fatura, Data (DD/MM/AAAA), Horário
          (HH24:MI ou HH24:MI:SS), Placa Veículo, Tipo do veículo, Descrição (nome da praça ou
          estacionamento), Tipo de uso (passagem/contrato/estacionamento), Valor(R$) (ex.: R$
          10,00 ou R$ -10,00), Débito/Crédito, Viagem de Vale Pedágio, Embarcador, Sentido da
          Praça. Separador vírgula ou ponto e vírgula. Veja o Manual.
        </p>
      </div>

      <SubmitButton />

      {state.error && <FormMessage type="error">{state.error}</FormMessage>}

      {state.lote && (
        <FormMessage type="success">
          Lote importado: {formatNumber(state.lote.total_linhas)} linha(s),{" "}
          {formatNumber(state.lote.total_erros)} erro(s) de formato.
        </FormMessage>
      )}

      {state.cadastrosCriados && state.cadastrosCriados.length > 0 && (
        <Alert variant="warning">
          <p>
            {formatNumber(state.cadastrosCriados.length)} cadastro(s) não existiam e foram criados
            automaticamente com os dados da planilha. As passagens deles ficam como &quot;Sem
            cadastro&quot; até o polígono ser desenhado:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {state.cadastrosCriados.map((c) => (
              <li key={`${c.tipo}-${c.nome}-${c.sentido ?? ""}`}>
                {c.tipo === "praca" ? "Praça" : "Estacionamento"} {c.nome}
                {c.sentido ? ` (sentido ${c.sentido})` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-1">
            Ajuste em{" "}
            {state.cadastrosCriados.some((c) => c.tipo === "praca") && (
              <Link href="/cadastros/pracas" className="underline">
                Cadastros › Praças
              </Link>
            )}
            {state.cadastrosCriados.some((c) => c.tipo === "praca") &&
              state.cadastrosCriados.some((c) => c.tipo === "estacionamento") &&
              " e "}
            {state.cadastrosCriados.some((c) => c.tipo === "estacionamento") && (
              <Link href="/cadastros/estacionamentos" className="underline">
                Cadastros › Estacionamentos
              </Link>
            )}
            .
          </p>
        </Alert>
      )}
    </form>
  );
}
