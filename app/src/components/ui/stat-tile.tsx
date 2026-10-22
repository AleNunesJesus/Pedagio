type StatTileProps = {
  label: string;
  value: React.ReactNode;
};

export function StatTile({ label, value }: StatTileProps) {
  return (
    <div className="min-w-0 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 break-words text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">
        {value}
      </p>
    </div>
  );
}
