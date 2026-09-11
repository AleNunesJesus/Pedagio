"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

type Ponto = {
  latitude: number;
  longitude: number;
  data_hora: string;
};

type MapaTrajetoProps = {
  pontos: Ponto[];
};

// Mapa somente leitura: plota o trajeto (polyline) e um marcador por ping,
// na ordem cronológica. Leaflet puro, mesmo padrão do PolygonMapEditor.
export function MapaTrajeto({ pontos }: MapaTrajetoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current).setView([-23.55, -46.63], 12);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    if (pontos.length > 0) {
      const latlngs = pontos.map((p) => [p.latitude, p.longitude] as [number, number]);

      L.polyline(latlngs, { color: "#2563eb", weight: 3 }).addTo(map);

      pontos.forEach((p, i) => {
        const marcador = L.circleMarker([p.latitude, p.longitude], {
          radius: i === pontos.length - 1 ? 7 : 4,
          color: i === pontos.length - 1 ? "#dc2626" : "#2563eb",
          fillOpacity: 0.8,
        }).addTo(map);
        marcador.bindPopup(new Date(p.data_hora).toLocaleString("pt-BR"));
      });

      map.fitBounds(L.latLngBounds(latlngs), { maxZoom: 16, padding: [20, 20] });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [pontos]);

  return (
    <div
      ref={containerRef}
      className="h-96 w-full rounded-md border border-gray-300 dark:border-gray-600"
    />
  );
}
