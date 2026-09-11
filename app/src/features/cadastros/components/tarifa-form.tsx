"use client";

import { useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { criarTarifa, type FormState } from "../actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { TextField, SelectField } from "@/components/ui/field";

const initialState: FormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : "Adicionar"}
    </Button>
  );
}

type Praca = { id: string; nome: string };
type Categoria = { id: string; codigo: string; descricao: string };

export function TarifaForm({ pracas, categorias }: { pracas: Praca[]; categorias: Categoria[] }) {
  const [state, formAction] = useActionState(criarTarifa, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <SelectField
        id="praca_id"
        name="praca_id"
        label="Praça"
        required
        placeholder="Selecione"
        options={pracas.map((p) => ({ value: p.id, label: p.nome }))}
      />
      <SelectField
        id="categoria_veiculo_id"
        name="categoria_veiculo_id"
        label="Categoria"
        required
        placeholder="Selecione"
        options={categorias.map((c) => ({ value: c.id, label: `${c.codigo} — ${c.descricao}` }))}
      />
      <TextField id="valor" name="valor" label="Valor (R$)" type="number" step="0.01" required />
      <TextField id="vigencia_inicio" name="vigencia_inicio" label="Início da vigência" type="date" required />
      <TextField id="vigencia_fim" name="vigencia_fim" label="Fim da vigência" type="date" />
      <SubmitButton />
      {state.error && <FormMessage type="error">{state.error}</FormMessage>}
    </form>
  );
}
