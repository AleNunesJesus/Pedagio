export default function CadastrosLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-[1800px] px-6 py-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Cadastros</h1>
      <div className="mt-6">{children}</div>
    </main>
  );
}
