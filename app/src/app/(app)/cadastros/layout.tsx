export default function CadastrosLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Cadastros</h1>
      <div className="mt-6">{children}</div>
    </main>
  );
}
