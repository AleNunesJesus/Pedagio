"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { SEQUENTIAL_BLUE, ink } from "../colors";
import { formatDay, formatNumber } from "@/lib/format";
import { ChartTooltipBox, toNumber, type RechartsTooltipProps } from "./chart-tooltip";
import { EmptyState } from "@/components/ui/card";
import { useTema } from "@/hooks/use-tema";

type Row = {
  dia: string;
  valor: number;
};

function TrendTooltip({ active, payload, label }: RechartsTooltipProps) {
  if (!active || !payload?.length || !label) return null;

  return (
    <ChartTooltipBox
      rows={[{ label: formatDay(String(label)), value: formatNumber(toNumber(payload[0].value)) }]}
    />
  );
}

export function TrendAreaChart({ rows }: { rows: Row[] }) {
  const INK = ink(useTema());

  if (rows.length === 0) {
    return <EmptyState>Sem dados no período.</EmptyState>;
  }

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SEQUENTIAL_BLUE} stopOpacity={0.1} />
              <stop offset="100%" stopColor={SEQUENTIAL_BLUE} stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={INK.grid} />
          <XAxis
            dataKey="dia"
            tickFormatter={(v: string) => formatDay(v)}
            tick={{ fill: INK.muted, fontSize: 12 }}
            axisLine={{ stroke: INK.baseline }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: INK.muted, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={40}
            allowDecimals={false}
          />
          <Tooltip content={TrendTooltip} />
          <Area
            type="monotone"
            dataKey="valor"
            stroke={SEQUENTIAL_BLUE}
            strokeWidth={2}
            fill="url(#trendFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
