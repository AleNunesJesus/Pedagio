"use client";

import { useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { criarCarreta, type FormState } from "../actions";
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

export function CarretaForm() {
  const [state, formAction] = useActionState(criarCarreta, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <TextField id="placa" name="placa" label="Placa/código" required placeholder="ABC1234" />
      <SelectField
        id="tipo"
        name="tipo"
        label="Tipo"
        required
        placeholder="Selecione"
        options={[
          { value: "comum", label: "Comum (3 eixos)" },
          { value: "vanderleia", label: "Vanderleia (4 eixos)" },
        ]}
      />
      <SubmitButton />
      {state.error && <FormMessage type="error">{state.error}</FormMessage>}
    </form>
  );
}
