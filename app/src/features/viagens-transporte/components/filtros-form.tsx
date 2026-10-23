import Link from "next/link";
import { SelectField, TextField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";

type Opcao = { id: string; nome: string };

// a busca do cabeçalho da página aponta para este form via atributo form=""
export const FILTROS_FORM_ID = "filtros-viagens";

type FiltrosFormProps = {
  veiculos: Opcao[];
  embarcadores: Opcao[];
  valores: {
    veiculoId?: string;
    tipoViagem?: string;
    embarcadorId?: string;
    divergencia?: string;
    dataInicio?: string;
    dataFim?: string;
  };
  contagens: {
    tipo: { carregado: number; vazio: number };
    divergencia: { mais: number; menos: number; zero: number };
  };
};

type OpcaoRadio = { value: string; label: string; qtd?: number; corQtd?: string };

function GrupoRadio({
  legenda,
  name,
  valor,
  opcoes,
}: {
  legenda: string;
  name: string;
  valor: string;
  opcoes: OpcaoRadio[];
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">{legenda}</legend>
      {opcoes.map((o) => (
        <label
          key={o.value}
          className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            defaultChecked={valor === o.value}
            className="h-4 w-4 accent-indigo-700"
          />
          {o.label}
          {o.qtd !== undefined && (
            <span className={`ml-auto text-xs tabular-nums ${o.corQtd ?? "text-gray-500 dark:text-gray-400"}`}>
              {formatNumber(o.qtd)}
            </span>
          )}
        </label>
      ))}
    </fieldset>
  );
}

export function FiltrosForm({ veiculos, embarcadores, valores, contagens }: FiltrosFormProps) {
  return (
    <form id={FILTROS_FORM_ID} method="get" className="space-y-6">
      <p className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">Filtros</p>

      <div className="space-y-3">
        <TextField
          id="dataInicio"
          name="dataInicio"
          label="Saída de"
          type="date"
          defaultValue={valores.dataInicio ?? ""}
        />
        <TextField id="dataFim" name="dataFim" label="Saída até" type="date" defaultValue={valores.dataFim ?? ""} />
      </div>

      <GrupoRadio
        legenda="Tipo"
        name="tipoViagem"
        valor={valores.tipoViagem ?? ""}
        opcoes={[
          { value: "", label: "Todos" },
          { value: "carregado", label: "Carregado", qtd: contagens.tipo.carregado },
          { value: "vazio", label: "Vazio", qtd: contagens.tipo.vazio },
        ]}
      />

      <GrupoRadio
        legenda="Divergência"
        name="divergencia"
        valor={valores.divergencia ?? ""}
        opcoes={[
          { value: "", label: "Todas" },
          {
            value: "mais",
            label: "Cobrado a mais",
            qtd: contagens.divergencia.mais,
            corQtd: "font-semibold text-red-700 dark:text-red-400",
          },
          {
            value: "menos",
            label: "Cobrado a menos",
            qtd: contagens.divergencia.menos,
            corQtd: "font-semibold text-green-700 dark:text-green-400",
          },
          { value: "zero", label: "Sem divergência", qtd: contagens.divergencia.zero },
        ]}
      />

      <SelectField
        id="embarcadorId"
        name="embarcadorId"
        label="Embarcador"
        placeholder="Todos"
        defaultValue={valores.embarcadorId ?? ""}
        options={embarcadores.map((e) => ({ value: e.id, label: e.nome }))}
      />
      <SelectField
        id="veiculoId"
        name="veiculoId"
        label="Veículo"
        placeholder="Todos"
        defaultValue={valores.veiculoId ?? ""}
        options={veiculos.map((v) => ({ value: v.id, label: v.nome }))}
      />

      <div className="space-y-2">
        <Button type="submit" fullWidth>
          Aplicar filtros
        </Button>
        <Link
          href="/viagens-transporte"
          className="block text-center text-sm text-gray-600 hover:underline dark:text-gray-400"
        >
          Limpar filtros
        </Link>
      </div>
    </form>
  );
}
