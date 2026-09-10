import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pedágio",
  description: "Controle de pagamento de pedágios",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
