import Link from "next/link";
import { SelectField, TextField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

type Opcao = { id: string; nome: string };

type FiltrosFormProps = {
  embarcadores: Opcao[];
  valores: {
    embarcadorId?: string;
    viagem?: string;
  };
};

export function FiltrosForm({ embarcadores, valores }: FiltrosFormProps) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
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
      <Button type="submit">Filtrar</Button>
      <Link
        href="/credito-debito"
        className="text-sm text-gray-500 hover:underline dark:text-gray-400"
      >
        Limpar
      </Link>
    </form>
  );
}
