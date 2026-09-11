type CardProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function Card({ title, subtitle, children }: CardProps) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</h2>
      {subtitle && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
      )}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
      {children}
    </p>
  );
}
