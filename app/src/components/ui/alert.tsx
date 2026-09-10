type AlertVariant = "warning" | "info";

const VARIANT_CLASSES: Record<AlertVariant, string> = {
  warning:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  info: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
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
