"use client";

import { useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { criarCategoria, type FormState } from "../actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { TextField } from "@/components/ui/field";

const initialState: FormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : "Adicionar"}
    </Button>
  );
}

export function CategoriaForm() {
  const [state, formAction] = useActionState(criarCategoria, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <TextField id="codigo" name="codigo" label="Código" required placeholder="EIXO_2" />
      <TextField
        id="descricao"
        name="descricao"
        label="Descrição"
        required
        placeholder="Eixo 2"
        className="min-w-[200px]"
      />
      <SubmitButton />
      {state.error && <FormMessage type="error">{state.error}</FormMessage>}
    </form>
  );
}
