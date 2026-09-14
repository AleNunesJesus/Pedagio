"use client";

import { useActionState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { salvarCategoria, type FormState } from "../actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { TextField } from "@/components/ui/field";

const initialState: FormState = {};

function SubmitButton({ editando }: { editando: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : editando ? "Salvar" : "Adicionar"}
    </Button>
  );
}

type CategoriaExistente = {
  id: string;
  codigo: string;
  descricao: string;
  quantidade_eixos: number;
};

export function CategoriaForm({ categoria }: { categoria?: CategoriaExistente }) {
  const [state, formAction] = useActionState(salvarCategoria, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success && !categoria) formRef.current?.reset();
  }, [state.success, categoria]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      {categoria && <input type="hidden" name="categoria_id" value={categoria.id} />}
      <TextField
        id="codigo"
        name="codigo"
        label="Código"
        required
        placeholder="EIXO_2"
        defaultValue={categoria?.codigo}
      />
      <TextField
        id="descricao"
        name="descricao"
        label="Descrição"
        required
        placeholder="Eixo 2"
        className="min-w-[200px]"
        defaultValue={categoria?.descricao}
      />
      <TextField
        id="quantidade_eixos"
        name="quantidade_eixos"
        type="number"
        min={1}
        label="Quantidade de eixos"
        required
        placeholder="6"
        className="w-32"
        defaultValue={categoria?.quantidade_eixos}
      />
      <SubmitButton editando={!!categoria} />
      {state.error && <FormMessage type="error">{state.error}</FormMessage>}
      {state.success && categoria && (
        <span className="text-xs text-green-600 dark:text-green-400">Salvo</span>
      )}
    </form>
  );
}
