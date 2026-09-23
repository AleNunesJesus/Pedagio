const ROLE_CLASSES = {
  operador: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  admin: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
} as const;

/** Selo que indica para qual papel uma seção ou ação do manual vale. */
export function RoleTag({
  role,
  children,
}: {
  role: keyof typeof ROLE_CLASSES;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_CLASSES[role]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}
