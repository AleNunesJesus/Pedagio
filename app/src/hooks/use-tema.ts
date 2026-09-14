"use client";

import { useSyncExternalStore } from "react";

// Recharts desenha em SVG com cores fixas (não responde a classes `dark:` do
// Tailwind) — componentes de gráfico (e o ThemeToggle) usam este hook pra
// saber o tema atual. `useSyncExternalStore` é a forma correta de assinar uma
// fonte externa mutável (a classe `.dark` em <html>, trocada pelo
// ThemeToggle) sem cair em "setState dentro de effect" nem gerar mismatch de
// hidratação — o snapshot do servidor sempre assume "light" porque o script
// inline em layout.tsx já corrige a classe antes da primeira pintura no
// cliente.
function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function getSnapshot(): "light" | "dark" {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerSnapshot(): "light" | "dark" {
  return "light";
}

export function useTema(): "light" | "dark" {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
