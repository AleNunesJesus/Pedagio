"use client";

import { useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { salvarTarifa, type FormState } from "../actions";
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

type Praca = { id: string; nome: string };
type Categoria = { id: string; codigo: string; descricao: string };

type TarifaExistente = {
  id: string;
  praca_id: string;
  categoria_veiculo_id: string;
  valor: number;
  vigencia_inicio: string;
  vigencia_fim: string | null;
};

export function TarifaForm({
  pracas,
  categorias,
  tarifa,
}: {
  pracas: Praca[];
  categorias: Categoria[];
  tarifa?: TarifaExistente;
}) {
  const [state, formAction] = useActionState(salvarTarifa, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success && !tarifa) formRef.current?.reset();
  }, [state.success, tarifa]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      {tarifa && <input type="hidden" name="tarifa_id" value={tarifa.id} />}
      <SelectField
        id="praca_id"
        name="praca_id"
        label="Praça"
        required
        placeholder="Selecione"
        defaultValue={tarifa?.praca_id}
        options={pracas.map((p) => ({ value: p.id, label: p.nome }))}
      />
      <SelectField
        id="categoria_veiculo_id"
        name="categoria_veiculo_id"
        label="Categoria"
        required
        placeholder="Selecione"
        defaultValue={tarifa?.categoria_veiculo_id}
        options={categorias.map((c) => ({ value: c.id, label: `${c.codigo} — ${c.descricao}` }))}
      />
      <TextField
        id="valor"
        name="valor"
        label="Valor (R$)"
        type="number"
        step="0.01"
        required
        defaultValue={tarifa?.valor}
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
