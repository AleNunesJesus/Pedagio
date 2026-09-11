"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

type Polygon = {
  type: "Polygon";
  coordinates: number[][][];
};

type Ponto = {
  latitude: number;
  longitude: number;
  data_hora: string;
};

type MapaValidacaoProps = {
  poligono: Polygon;
  ponto: Ponto | null;
  dentroPoligono: boolean | null;
};

// Mapa somente leitura: polígono da praça + o ping de GPS usado (ou mais
// próximo) na validação da passagem, colorido conforme o resultado.
export function MapaValidacao({ poligono, ponto, dentroPoligono }: MapaValidacaoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current).setView([-23.55, -46.63], 13);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const poligonoLayer = L.geoJSON(poligono, { style: { color: "#6b7280", weight: 2 } }).addTo(map);
    const bounds = poligonoLayer.getBounds();

    if (ponto) {
      const cor = dentroPoligono === true ? "#16a34a" : dentroPoligono === false ? "#dc2626" : "#6b7280";
      const marcador = L.circleMarker([ponto.latitude, ponto.longitude], {
        radius: 7,
        color: cor,
        fillOpacity: 0.8,
      }).addTo(map);
      marcador.bindPopup(new Date(ponto.data_hora).toLocaleString("pt-BR"));
      bounds.extend([ponto.latitude, ponto.longitude]);
    }

    map.fitBounds(bounds, { maxZoom: 17, padding: [20, 20] });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [poligono, ponto, dentroPoligono]);

  return (
    <div
      ref={containerRef}
      className="h-80 w-full rounded-md border border-gray-300 dark:border-gray-600"
    />
  );
}
