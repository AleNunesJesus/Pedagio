"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { salvarVeiculo, type FormState } from "../actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { TextField, SelectField, CheckboxField } from "@/components/ui/field";

const initialState: FormState = {};

function SubmitButton({ editando }: { editando: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : editando ? "Salvar" : "Adicionar"}
    </Button>
  );
}

type Categoria = { id: string; codigo: string; descricao: string; quantidade_eixos: number };

type VeiculoExistente = {
  id: string;
  placa: string;
  tipo: string;
  categoria_veiculo_id: string;
  categoria_fallback_id: string | null;
  frota: string | null;
  ativo: boolean;
};

export function VeiculoForm({
  categorias,
  veiculo,
}: {
  categorias: Categoria[];
  veiculo?: VeiculoExistente;
}) {
  const [state, formAction] = useActionState(salvarVeiculo, initialState);
  const [tipo, setTipo] = useState<"cavalo" | "carreta">(
    (veiculo?.tipo as "cavalo" | "carreta") ?? "cavalo",
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success && !veiculo) formRef.current?.reset();
  }, [state.success, veiculo]);

  const opcoesCategoria = categorias.map((c) => ({
    value: c.id,
    label: `${c.codigo} — ${c.descricao} (${c.quantidade_eixos} eixos)`,
  }));

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      {veiculo && <input type="hidden" name="veiculo_id" value={veiculo.id} />}
      <TextField
        id="placa"
        name="placa"
        label="Placa"
        required
        placeholder="ABC1D23"
        defaultValue={veiculo?.placa}
      />
      <SelectField
        id="tipo"
        name="tipo"
        label="Tipo"
        required
        value={tipo}
        onChange={(e) => setTipo(e.target.value as "cavalo" | "carreta")}
        options={[
          { value: "cavalo", label: "Cavalo mecânico" },
          { value: "carreta", label: "Carreta" },
        ]}
      />
      <SelectField
        id="categoria_veiculo_id"
        name="categoria_veiculo_id"
        label="Categoria (eixos próprios)"
        required
        placeholder="Selecione"
        defaultValue={veiculo?.categoria_veiculo_id}
        options={opcoesCategoria}
      />
      {tipo === "cavalo" && (
        <SelectField
          id="categoria_fallback_id"
          name="categoria_fallback_id"
          label="Categoria de fallback (tarifa quando a composição não é conhecida)"
          required
          placeholder="Selecione"
          className="min-w-[280px]"
          defaultValue={veiculo?.categoria_fallback_id ?? undefined}
          options={opcoesCategoria}
        />
      )}
      <TextField
        id="frota"
        name="frota"
        label="Frota"
        placeholder="opcional"
        defaultValue={veiculo?.frota ?? ""}
      />
      <CheckboxField id="ativo" name="ativo" label="Ativo" defaultChecked={veiculo?.ativo ?? true} />
      <SubmitButton editando={!!veiculo} />
      {state.error && <FormMessage type="error">{state.error}</FormMessage>}
      {state.success && veiculo && (
        <span className="text-xs text-green-600 dark:text-green-400">Salvo</span>
      )}
    </form>
  );
}
