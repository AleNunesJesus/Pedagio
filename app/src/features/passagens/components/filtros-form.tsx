import Link from "next/link";
import { STATUS_VALIDACAO_INFO } from "@/lib/status-validacao";
import { SelectField, TextField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

type Opcao = { id: string; nome: string };

type FiltrosFormProps = {
  pracas: Opcao[];
  veiculos: Opcao[];
  embarcadores: Opcao[];
  valores: {
    status?: string;
    pracaId?: string;
    veiculoId?: string;
    tipoUso?: string;
    embarcadorId?: string;
    viagem?: string;
    dataInicio?: string;
    dataFim?: string;
  };
};

const OPCOES_TIPO_USO = [
  { value: "passagem", label: "Passagem" },
  { value: "contrato", label: "Contrato" },
];

export function FiltrosForm({ pracas, veiculos, embarcadores, valores }: FiltrosFormProps) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <SelectField
        id="status"
        name="status"
        label="Status"
        placeholder="Todos"
        defaultValue={valores.status ?? ""}
        options={Object.entries(STATUS_VALIDACAO_INFO).map(([value, info]) => ({
          value,
          label: info.label,
        }))}
      />
      <SelectField
        id="pracaId"
        name="pracaId"
        label="Praça"
        placeholder="Todas"
        defaultValue={valores.pracaId ?? ""}
        options={pracas.map((p) => ({ value: p.id, label: p.nome }))}
      />
      <SelectField
        id="veiculoId"
        name="veiculoId"
        label="Veículo"
        placeholder="Todos"
        defaultValue={valores.veiculoId ?? ""}
        options={veiculos.map((v) => ({ value: v.id, label: v.nome }))}
      />
      <SelectField
        id="tipoUso"
        name="tipoUso"
        label="Tipo de uso"
        placeholder="Todos"
        defaultValue={valores.tipoUso ?? ""}
        options={OPCOES_TIPO_USO}
      />
      <SelectField
        id="embarcadorId"
        name="embarcadorId"
        label="Embarcador"
        placeholder="Todos"
        defaultValue={valores.embarcadorId ?? ""}
        options={embarcadores.map((e) => ({ value: e.id, label: e.nome }))}
      />
      <TextField
        id="viagem"
        name="viagem"
        label="Viagem"
        placeholder="Número da viagem"
        defaultValue={valores.viagem ?? ""}
      />
      <TextField
        id="dataInicio"
        name="dataInicio"
        label="De"
        type="date"
        defaultValue={valores.dataInicio ?? ""}
      />
      <TextField
        id="dataFim"
        name="dataFim"
        label="Até"
        type="date"
        defaultValue={valores.dataFim ?? ""}
      />
      <Button type="submit">Filtrar</Button>
      <Link
        href="/passagens"
        className="text-sm text-gray-500 hover:underline dark:text-gray-400"
      >
        Limpar
      </Link>
    </form>
  );
}
