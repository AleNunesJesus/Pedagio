import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pedágio",
  description: "Controle de pagamento de pedágios",
};

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {/* Aplica a classe .dark antes da primeira pintura (evita "flash" de
            tema errado) — precisa rodar de forma síncrona e bem cedo, por
            isso é um script inline no início do body em vez de um useEffect. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
