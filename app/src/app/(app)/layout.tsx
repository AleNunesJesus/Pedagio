import { requireAutorizado } from "@/lib/auth/guards";
import { AppSidebar } from "@/components/app-sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { papel } = await requireAutorizado();

  return (
    <div className="min-h-screen bg-gray-100 md:flex dark:bg-gray-950">
      <AppSidebar papel={papel} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
