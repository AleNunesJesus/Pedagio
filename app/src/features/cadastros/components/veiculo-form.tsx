"use client";

import { useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { criarVeiculo, type FormState } from "../actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { TextField, SelectField, CheckboxField } from "@/components/ui/field";

const initialState: FormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : "Adicionar"}
    </Button>
  );
}

type Categoria = { id: string; codigo: string; descricao: string };

export function VeiculoForm({ categorias }: { categorias: Categoria[] }) {
  const [state, formAction] = useActionState(criarVeiculo, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <TextField id="placa" name="placa" label="Placa" required placeholder="ABC1D23" />
      <SelectField
        id="categoria_veiculo_id"
        name="categoria_veiculo_id"
        label="Categoria"
        required
        placeholder="Selecione"
        options={categorias.map((c) => ({ value: c.id, label: `${c.codigo} — ${c.descricao}` }))}
      />
      <TextField id="frota" name="frota" label="Frota" placeholder="opcional" />
      <CheckboxField id="ativo" name="ativo" label="Ativo" defaultChecked />
      <SubmitButton />
      {state.error && <FormMessage type="error">{state.error}</FormMessage>}
    </form>
  );
}
