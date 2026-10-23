import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

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
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {/* Aplica a classe .dark antes da primeira pintura (evita "flash" de
            tema errado) — precisa rodar de forma síncrona e bem cedo, por
            isso é `next/script` com strategy="beforeInteractive" em vez de
            um useEffect. Um <script> JSX cru causava o warning "Encountered
            a script tag while rendering React component" e, em navegações
            que re-renderizam o layout raiz, a classe .dark (adicionada
            imperativamente, fora do controle do React) podia ser perdida
            quando o React recommitava o className original do <html>. */}
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        {children}
      </body>
    </html>
  );
}
