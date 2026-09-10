type FormMessageProps = {
  type: "error" | "success";
  children: React.ReactNode;
};

const TYPE_CLASSES: Record<FormMessageProps["type"], string> = {
  error:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400",
  success:
    "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400",
};

export function FormMessage({ type, children }: FormMessageProps) {
  return (
    <p className={`rounded-md border px-3 py-2 text-sm ${TYPE_CLASSES[type]}`}>
      {children}
    </p>
  );
}
