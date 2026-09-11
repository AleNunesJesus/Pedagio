import { requireAutorizado } from "@/lib/auth/guards";
import { AppHeader } from "@/components/app-header";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { papel } = await requireAutorizado();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AppHeader papel={papel} />
      {children}
    </div>
  );
}
