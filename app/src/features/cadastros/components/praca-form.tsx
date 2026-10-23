"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { salvarPraca, type FormState } from "../actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Alert } from "@/components/ui/alert";
import { TextField, SelectField, CheckboxField } from "@/components/ui/field";
import { sugerirBusca, type ResultadoBusca } from "@/lib/geo-osm";
import { UFS } from "@/lib/ufs";
import { LocalizarNoMapa } from "./localizar-no-mapa";
import type { FocoMapa } from "./polygon-map-editor";

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
  endereco: string | null;
  municipio: string | null;
  uf: string | null;
  ativo: boolean;
  poligono_geojson: Polygon | null;
  cadastro_pendente: boolean;
  origem: { arquivo_nome: string | null; created_at: string } | null;
};

export function PracaForm({ praca }: { praca?: PracaExistente }) {
  const [state, formAction, pending] = useActionState(salvarPraca, initialState);
  const [poligono, setPoligono] = useState<Polygon | null>(praca?.poligono_geojson ?? null);
  const [foco, setFoco] = useState<FocoMapa | null>(null);
  const enderecoRef = useRef<HTMLInputElement>(null);
  const municipioRef = useRef<HTMLInputElement>(null);
  const ufRef = useRef<HTMLSelectElement>(null);

  function escolherResultado(r: ResultadoBusca) {
    setFoco((f) => ({ lat: r.lat, lon: r.lon, bbox: r.bbox, seq: (f?.seq ?? 0) + 1 }));
    // campos não controlados: preenche direto e o usuário ainda pode editar
    if (enderecoRef.current) enderecoRef.current.value = r.endereco;
    if (municipioRef.current) municipioRef.current.value = r.municipio ?? "";
    if (ufRef.current && r.uf && UFS.includes(r.uf)) ufRef.current.value = r.uf;
  }

  return (
    // envio por onSubmit (e não action=): com action= o React 19 reseta o form
    // depois da resposta, apagando o que foi digitado mesmo quando dá erro
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const dados = new FormData(e.currentTarget);
        startTransition(() => formAction(dados));
      }}
      className="space-y-4"
    >
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

      <div className="grid gap-3 sm:grid-cols-[1fr_14rem_6rem]">
        <TextField
          ref={enderecoRef}
          id="endereco"
          name="endereco"
          label="Endereço"
          defaultValue={praca?.endereco ?? ""}
        />
        <TextField
          ref={municipioRef}
          id="municipio"
          name="municipio"
          label="Município"
          defaultValue={praca?.municipio ?? ""}
        />
        <SelectField
          id="uf"
          name="uf"
          label="UF"
          placeholder="—"
          options={UFS.map((uf) => ({ value: uf, label: uf }))}
          ref={ufRef}
          defaultValue={praca?.uf ?? ""}
        />
      </div>

      <div className="space-y-3">
        <LocalizarNoMapa
          sugestoes={praca ? sugerirBusca(praca.nome, praca.rodovia) : []}
          onEscolher={escolherResultado}
        />
        <div>
          <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            Área da praça (desenhe o polígono)
          </p>
          <PolygonMapEditor
            initialGeoJSON={praca?.poligono_geojson ?? null}
            onChange={setPoligono}
            foco={foco}
            mostrarCabines
          />
          {!poligono && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Clique numa cabine do OpenStreetMap para criar um polígono inicial, ou use a
              ferramenta de polígono (à esquerda do mapa) para desenhar a área. A camada
              &quot;Satélite&quot; (canto superior direito) ajuda a ver a cabine.
            </p>
          )}
        </div>
      </div>

      {state.error && <FormMessage type="error">{state.error}</FormMessage>}
      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}
