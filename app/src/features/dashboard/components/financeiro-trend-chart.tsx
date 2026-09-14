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
import { CATEGORICAL, ink } from "../colors";
import { formatBRL, formatMonth } from "@/lib/format";
import { ChartTooltipBox, toNumber, type RechartsTooltipProps } from "./chart-tooltip";
import { EmptyState } from "@/components/ui/card";
import { useTema } from "@/hooks/use-tema";

type Row = {
  mes: string | null;
  total_cobrado: number | null;
  total_esperado: number | null;
};

function TrendTooltip({ active, payload, label }: RechartsTooltipProps) {
  if (!active || !payload?.length || !label) return null;

  return (
    <ChartTooltipBox
      rows={[
        {
          label: "Cobrado",
          value: formatBRL(toNumber(payload.find((p) => p.dataKey === "total_cobrado")?.value)),
          color: CATEGORICAL.blue,
        },
        {
          label: "Esperado",
          value: formatBRL(toNumber(payload.find((p) => p.dataKey === "total_esperado")?.value)),
          color: CATEGORICAL.orange,
        },
      ]}
    />
  );
}

export function FinanceiroTrendChart({ rows }: { rows: Row[] }) {
  const INK = ink(useTema());

  if (rows.length === 0) {
    return <EmptyState>Nenhuma passagem importada ainda.</EmptyState>;
  }

  const data = rows.map((row) => ({
    ...row,
    mesLabel: row.mes ? formatMonth(row.mes) : "",
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
          <Tooltip content={TrendTooltip} />
          <Legend
            wrapperStyle={{ fontSize: 12, color: INK.secondary }}
            formatter={(value) => (value === "total_cobrado" ? "Cobrado" : "Esperado")}
          />
          <Line
            type="monotone"
            dataKey="total_cobrado"
            stroke={CATEGORICAL.blue}
            strokeWidth={2}
            dot={{ r: 4, fill: CATEGORICAL.blue, stroke: INK.dotStroke, strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="total_esperado"
            stroke={CATEGORICAL.orange}
            strokeWidth={2}
            dot={{ r: 4, fill: CATEGORICAL.orange, stroke: INK.dotStroke, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
