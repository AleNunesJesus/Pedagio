"use client";

import { useActionState, useState } from "react";
import dynamic from "next/dynamic";
import { useFormStatus } from "react-dom";
import { salvarPraca, type FormState } from "../actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Alert } from "@/components/ui/alert";
import { TextField, CheckboxField } from "@/components/ui/field";

const PolygonMapEditor = dynamic(
  () => import("./polygon-map-editor").then((m) => m.PolygonMapEditor),
  { ssr: false, loading: () => <div className="h-96 w-full animate-pulse rounded-md bg-gray-100 dark:bg-gray-800" /> },
);

const initialState: FormState = {};

type Polygon = { type: "Polygon"; coordinates: number[][][] };

type PracaExistente = {
  id: string;
  nome: string;
  rodovia: string | null;
  concessionaria: string | null;
  km: number | null;
  sentido: string | null;
  ativo: boolean;
  poligono_geojson: Polygon | null;
  cadastro_pendente: boolean;
  origem: { arquivo_nome: string | null; created_at: string } | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : "Salvar"}
    </Button>
  );
}

export function PracaForm({ praca }: { praca?: PracaExistente }) {
  const [state, formAction] = useActionState(salvarPraca, initialState);
  const [poligono, setPoligono] = useState<Polygon | null>(praca?.poligono_geojson ?? null);

  return (
    <form action={formAction} className="space-y-4">
      {praca && <input type="hidden" name="praca_id" value={praca.id} />}
      {praca?.cadastro_pendente && (
        <Alert variant="warning">
          Praça criada automaticamente pela importação
          {praca.origem
            ? ` do arquivo ${praca.origem.arquivo_nome ?? "(sem nome)"} em ${new Date(praca.origem.created_at).toLocaleString("pt-BR")}`
            : " da fatura"}
          , com o nome e o sentido que vieram na planilha. Desenhe o polígono e complete os dados;
          ao salvar, o cadastro deixa de ser pendente e as passagens desta praça são revalidadas.
          Nome e sentido são usados para reconhecer a praça nas próximas importações — se mudar,
          a planilha com o nome antigo vai criar outra praça.
        </Alert>
      )}
      <input
        type="hidden"
        name="poligono_geojson"
        value={poligono ? JSON.stringify(poligono) : ""}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <TextField id="nome" name="nome" label="Nome" required defaultValue={praca?.nome} />
        <TextField id="rodovia" name="rodovia" label="Rodovia" defaultValue={praca?.rodovia ?? ""} />
        <TextField
          id="concessionaria"
          name="concessionaria"
          label="Concessionária"
          defaultValue={praca?.concessionaria ?? ""}
        />
        <TextField id="km" name="km" label="Km" type="number" step="0.01" defaultValue={praca?.km ?? ""} />
        <TextField id="sentido" name="sentido" label="Sentido" defaultValue={praca?.sentido ?? ""} />
        <CheckboxField
          id="ativo"
          name="ativo"
          label="Ativa"
          defaultChecked={praca?.ativo ?? true}
        />
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
          Área da praça (desenhe o polígono)
        </p>
        <PolygonMapEditor initialGeoJSON={praca?.poligono_geojson ?? null} onChange={setPoligono} />
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
