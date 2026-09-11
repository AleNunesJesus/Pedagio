"use client";

import dynamic from "next/dynamic";

export const MapaValidacaoLoader = dynamic(
  () => import("./mapa-validacao").then((m) => m.MapaValidacao),
  {
    ssr: false,
    loading: () => (
      <div className="h-80 w-full animate-pulse rounded-md bg-gray-100 dark:bg-gray-800" />
    ),
  },
);
