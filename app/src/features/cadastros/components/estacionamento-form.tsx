"use client";

import { useActionState, useState } from "react";
import dynamic from "next/dynamic";
import { useFormStatus } from "react-dom";
import { salvarEstacionamento, type FormState } from "../actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { TextField, CheckboxField } from "@/components/ui/field";

const PolygonMapEditor = dynamic(
  () => import("./polygon-map-editor").then((m) => m.PolygonMapEditor),
  { ssr: false, loading: () => <div className="h-96 w-full animate-pulse rounded-md bg-gray-100 dark:bg-gray-800" /> },
);

const initialState: FormState = {};

type Polygon = { type: "Polygon"; coordinates: number[][][] };

type EstacionamentoExistente = {
  id: string;
  nome: string;
  ativo: boolean;
  poligono_geojson: Polygon;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : "Salvar"}
    </Button>
  );
}

export function EstacionamentoForm({ estacionamento }: { estacionamento?: EstacionamentoExistente }) {
  const [state, formAction] = useActionState(salvarEstacionamento, initialState);
  const [poligono, setPoligono] = useState<Polygon | null>(estacionamento?.poligono_geojson ?? null);

  return (
    <form action={formAction} className="space-y-4">
      {estacionamento && <input type="hidden" name="estacionamento_id" value={estacionamento.id} />}
      <input
        type="hidden"
        name="poligono_geojson"
        value={poligono ? JSON.stringify(poligono) : ""}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <TextField id="nome" name="nome" label="Nome" required defaultValue={estacionamento?.nome} />
        <CheckboxField
          id="ativo"
          name="ativo"
          label="Ativo"
          defaultChecked={estacionamento?.ativo ?? true}
        />
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
          Área do estacionamento (desenhe o polígono)
        </p>
        <PolygonMapEditor initialGeoJSON={estacionamento?.poligono_geojson ?? null} onChange={setPoligono} />
        {!poligono && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Use a ferramenta de polígono no canto superior direito do mapa para
            desenhar a área.
          </p>
        )}
      </div>

      {state.error && <FormMessage type="error">{state.error}</FormMessage>}
      <SubmitButton />
    </form>
  );
}
