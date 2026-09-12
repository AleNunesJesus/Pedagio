"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { CATEGORICAL, INK } from "../colors";
import { formatBRL, formatMonth } from "@/lib/format";
import { ChartTooltipBox, toNumber, type RechartsTooltipProps } from "./chart-tooltip";
import { EmptyState } from "@/components/ui/card";

type Row = {
  mes: string;
  valor_carregado: number;
  valor_vazio: number;
  valor_sem_vinculo: number;
};

function VinculoViagemTooltip({ active, payload, label }: RechartsTooltipProps) {
  if (!active || !payload?.length || !label) return null;

  return (
    <ChartTooltipBox
      rows={[
        {
          label: "Carregado",
          value: formatBRL(toNumber(payload.find((p) => p.dataKey === "valor_carregado")?.value)),
          color: CATEGORICAL.blue,
        },
        {
          label: "Vazio",
          value: formatBRL(toNumber(payload.find((p) => p.dataKey === "valor_vazio")?.value)),
          color: CATEGORICAL.orange,
        },
        {
          label: "Sem vínculo",
          value: formatBRL(toNumber(payload.find((p) => p.dataKey === "valor_sem_vinculo")?.value)),
          color: CATEGORICAL.aqua,
        },
      ]}
    />
  );
}

const LEGEND_LABEL: Record<string, string> = {
  valor_carregado: "Carregado",
  valor_vazio: "Vazio",
  valor_sem_vinculo: "Sem vínculo",
};

export function ValoresVinculoViagemChart({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return <EmptyState>Nenhuma passagem importada ainda.</EmptyState>;
  }

  const data = rows.map((row) => ({
    ...row,
    mesLabel: formatMonth(row.mes),
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={INK.grid} />
          <XAxis
            dataKey="mesLabel"
            tick={{ fill: INK.muted, fontSize: 12 }}
            axisLine={{ stroke: INK.baseline }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: INK.muted, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={72}
            tickFormatter={(v: number) => formatBRL(v)}
          />
          <Tooltip content={VinculoViagemTooltip} />
          <Legend
            wrapperStyle={{ fontSize: 12, color: INK.secondary }}
            formatter={(value) => LEGEND_LABEL[value] ?? value}
          />
          <Line
            type="monotone"
            dataKey="valor_carregado"
            stroke={CATEGORICAL.blue}
            strokeWidth={2}
            dot={{ r: 4, fill: CATEGORICAL.blue, stroke: "#fcfcfb", strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="valor_vazio"
            stroke={CATEGORICAL.orange}
            strokeWidth={2}
            dot={{ r: 4, fill: CATEGORICAL.orange, stroke: "#fcfcfb", strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="valor_sem_vinculo"
            stroke={CATEGORICAL.aqua}
            strokeWidth={2}
            dot={{ r: 4, fill: CATEGORICAL.aqua, stroke: "#fcfcfb", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
