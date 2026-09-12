import Link from "next/link";
import { TextField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

type FiltrosFormProps = {
  valores: {
    dataInicio?: string;
    dataFim?: string;
  };
};

export function FiltrosForm({ valores }: FiltrosFormProps) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <TextField
        id="dataInicio"
        name="dataInicio"
        label="Período de"
        type="date"
        defaultValue={valores.dataInicio ?? ""}
      />
      <TextField
        id="dataFim"
        name="dataFim"
        label="Período até"
        type="date"
        defaultValue={valores.dataFim ?? ""}
      />
      <Button type="submit">Filtrar</Button>
      <Link href="/faturas" className="text-sm text-gray-500 hover:underline dark:text-gray-400">
        Limpar
      </Link>
    </form>
  );
}
