import { LoginForm } from "@/features/auth/components/login-form";
import { Alert } from "@/components/ui/alert";

type LoginPageProps = {
  searchParams: Promise<{ sessao?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const sessaoExpirada = params.sessao === "expirada";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Controle de Pagamento de Pedágios
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Entre com suas credenciais para continuar.
        </p>

        {sessaoExpirada && (
          <Alert variant="warning" className="mt-4">
            Sua sessão expirou. Faça login novamente.
          </Alert>
        )}

        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
