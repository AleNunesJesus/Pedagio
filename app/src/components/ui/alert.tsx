type AlertVariant = "warning" | "info";

const VARIANT_CLASSES: Record<AlertVariant, string> = {
  warning:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  info: "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300",
};

type AlertProps = {
  variant: AlertVariant;
  className?: string;
  children: React.ReactNode;
};

export function Alert({ variant, className = "", children }: AlertProps) {
  return (
    <div
      className={`rounded-md border px-3 py-2 text-sm ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </div>
  );
}
