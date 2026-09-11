"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from "recharts";
import { SEQUENTIAL_BLUE, INK } from "../colors";
import { formatBRL } from "@/lib/format";
import { ChartTooltipBox, type RechartsTooltipProps } from "./chart-tooltip";
import { EmptyState } from "@/components/ui/card";

type Row = {
  praca_id: string | null;
  praca_nome: string | null;
  total_cobrado: number | null;
};

function GastoTooltip({ active, payload }: RechartsTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as Row;

  return (
    <ChartTooltipBox
      rows={[
        { label: row.praca_nome ?? "—", value: formatBRL(row.total_cobrado) },
      ]}
    />
  );
}

export function GastoPorPracaChart({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return <EmptyState>Nenhuma passagem importada ainda.</EmptyState>;
  }

  const data = [...rows].reverse();
  const altura = Math.max(160, data.length * 36);

  return (
    <div style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 40, left: 8, bottom: 0 }}
          barCategoryGap={8}
        >
          <CartesianGrid horizontal={false} stroke={INK.grid} />
          <XAxis
            type="number"
            tick={{ fill: INK.muted, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => formatBRL(v)}
          />
          <YAxis
            type="category"
            dataKey="praca_nome"
            tick={{ fill: INK.secondary, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={140}
          />
          <Tooltip content={GastoTooltip} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
          <Bar dataKey="total_cobrado" fill={SEQUENTIAL_BLUE} radius={[0, 4, 4, 0]} maxBarSize={24}>
            <LabelList
              dataKey="total_cobrado"
              position="right"
              formatter={(v: string | number | boolean | null | undefined) =>
                formatBRL(typeof v === "number" ? v : Number(v))
              }
              style={{ fill: INK.secondary, fontSize: 12 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
