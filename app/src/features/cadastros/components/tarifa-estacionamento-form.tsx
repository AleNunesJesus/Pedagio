"use client";

import { useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { salvarTarifaEstacionamento, type FormState } from "../actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { TextField, SelectField } from "@/components/ui/field";

const initialState: FormState = {};

function SubmitButton({ editando }: { editando: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : editando ? "Salvar" : "Adicionar"}
    </Button>
  );
}

type Estacionamento = { id: string; nome: string };

type TarifaExistente = {
  id: string;
  estacionamento_id: string;
  valor_diaria: number;
  vigencia_inicio: string;
  vigencia_fim: string | null;
};

export function TarifaEstacionamentoForm({
  estacionamentos,
  tarifa,
}: {
  estacionamentos: Estacionamento[];
  tarifa?: TarifaExistente;
}) {
  const [state, formAction] = useActionState(salvarTarifaEstacionamento, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success && !tarifa) formRef.current?.reset();
  }, [state.success, tarifa]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      {tarifa && <input type="hidden" name="tarifa_id" value={tarifa.id} />}
      <SelectField
        id="estacionamento_id"
        name="estacionamento_id"
        label="Estacionamento"
        required
        placeholder="Selecione"
        defaultValue={tarifa?.estacionamento_id}
        options={estacionamentos.map((e) => ({ value: e.id, label: e.nome }))}
      />
      <TextField
        id="valor_diaria"
        name="valor_diaria"
        label="Valor da diária (R$)"
        type="number"
        step="0.01"
        required
        defaultValue={tarifa?.valor_diaria}
      />
      <TextField
        id="vigencia_inicio"
        name="vigencia_inicio"
        label="Início da vigência"
        type="date"
        required
        defaultValue={tarifa?.vigencia_inicio}
      />
      <TextField
        id="vigencia_fim"
        name="vigencia_fim"
        label="Fim da vigência"
        type="date"
        defaultValue={tarifa?.vigencia_fim ?? ""}
      />
      <SubmitButton editando={!!tarifa} />
      {state.error && <FormMessage type="error">{state.error}</FormMessage>}
      {state.success && tarifa && (
        <span className="text-xs text-green-600 dark:text-green-400">Salvo</span>
      )}
    </form>
  );
}
