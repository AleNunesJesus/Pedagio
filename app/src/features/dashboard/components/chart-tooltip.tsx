import type { TooltipContentProps } from "recharts";

type Row = { label: string; value: string; color?: string };

export function ChartTooltipBox({ rows }: { rows: Row[] }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-2">
          {row.color && (
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: row.color }}
              aria-hidden
            />
          )}
          <span className="text-gray-500 dark:text-gray-400">{row.label}:</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export type RechartsTooltipProps = TooltipContentProps;

export function toNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}
