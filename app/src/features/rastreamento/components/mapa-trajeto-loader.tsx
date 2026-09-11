"use client";

import dynamic from "next/dynamic";

export const MapaTrajetoLoader = dynamic(
  () => import("./mapa-trajeto").then((m) => m.MapaTrajeto),
  {
    ssr: false,
    loading: () => (
      <div className="h-96 w-full animate-pulse rounded-md bg-gray-100 dark:bg-gray-800" />
    ),
  },
);
