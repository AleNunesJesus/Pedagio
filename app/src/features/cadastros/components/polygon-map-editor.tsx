"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import L from "leaflet";
import "leaflet-draw";

type Polygon = {
  type: "Polygon";
  coordinates: number[][][];
};

type PolygonMapEditorProps = {
  initialGeoJSON?: Polygon | null;
  onChange: (geojson: Polygon | null) => void;
};

// Desenha/edita exatamente um polígono por vez — o suficiente para o cadastro
// de área de uma praça de pedágio. Leaflet puro (não react-leaflet) para não
// depender de peer-deps de React desse ecossistema.
export function PolygonMapEditor({ initialGeoJSON, onChange }: PolygonMapEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([-23.55, -46.63], 13);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    if (initialGeoJSON) {
      const layer = L.geoJSON(initialGeoJSON).getLayers()[0] as L.Polygon;
      drawnItems.addLayer(layer);
      map.fitBounds(layer.getBounds(), { maxZoom: 17 });
    }

    const drawControl = new L.Control.Draw({
      draw: {
        polygon: { allowIntersection: false, showArea: true },
        polyline: false,
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: false,
      },
      edit: { featureGroup: drawnItems, remove: true },
    });
    map.addControl(drawControl);

    function emitirMudanca() {
      const layers = drawnItems.getLayers();
      if (layers.length === 0) {
        onChange(null);
        return;
      }
      const layer = layers[0] as L.Polygon;
      onChange(layer.toGeoJSON().geometry as Polygon);
    }

    map.on(L.Draw.Event.CREATED, (e: L.LeafletEvent) => {
      // só um polígono por vez: remove o anterior antes de adicionar o novo
      const evento = e as L.DrawEvents.Created;
      drawnItems.clearLayers();
      drawnItems.addLayer(evento.layer);
      emitirMudanca();
    });
    map.on(L.Draw.Event.EDITED, emitirMudanca);
    map.on(L.Draw.Event.DELETED, emitirMudanca);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-96 w-full rounded-md border border-gray-300 dark:border-gray-600"
    />
  );
}
