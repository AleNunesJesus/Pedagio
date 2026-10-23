"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import L from "leaflet";
import "leaflet-draw";
import { poligonoEmVolta, type CabineOsm } from "@/lib/geo-osm";
import { listarCabinesOsm } from "../actions";

type Polygon = {
  type: "Polygon";
  coordinates: number[][][];
};

// ponto escolhido na busca "Localizar no mapa"; seq muda a cada escolha para
// recentralizar mesmo quando o resultado é o mesmo
export type FocoMapa = {
  lat: number;
  lon: number;
  bbox: [number, number, number, number] | null;
  seq: number;
};

type PolygonMapEditorProps = {
  initialGeoJSON?: Polygon | null;
  onChange: (geojson: Polygon | null) => void;
  foco?: FocoMapa | null;
  // cabines de pedágio do OSM na área visível (só no cadastro de praça)
  mostrarCabines?: boolean;
};

// abaixo disso a área visível pega um estado inteiro — marcadores demais
const ZOOM_MIN_CABINES = 9;

type EstadoCabines =
  | { estado: "longe" }
  | { estado: "buscando" }
  | { estado: "pronto"; qtd: number; truncado: boolean }
  | { estado: "erro"; erro: string };

// Desenha/edita exatamente um polígono por vez — o suficiente para o cadastro
// de área de uma praça de pedágio. Leaflet puro (não react-leaflet) para não
// depender de peer-deps de React desse ecossistema.
export function PolygonMapEditor({ initialGeoJSON, onChange, foco, mostrarCabines = false }: PolygonMapEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const focoRef = useRef<L.CircleMarker | null>(null);
  const [cabines, setCabines] = useState<EstadoCabines>({ estado: "longe" });

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([-23.55, -46.63], 13);
    mapRef.current = map;

    const mapa = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    const satelite = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Imagens &copy; Esri, Maxar, Earthstar Geographics",
        maxZoom: 19,
      },
    );
    L.control.layers({ Mapa: mapa, "Satélite": satelite }, undefined, { position: "topright" }).addTo(map);

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    const grupoCabines = L.layerGroup().addTo(map);

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

    function usarCabine(c: CabineOsm) {
      if (
        drawnItems.getLayers().length > 0 &&
        !window.confirm("Substituir o polígono atual por um novo em volta desta cabine?")
      ) {
        return;
      }
      const layer = L.geoJSON(poligonoEmVolta(c)).getLayers()[0] as L.Polygon;
      drawnItems.clearLayers();
      drawnItems.addLayer(layer);
      map.closePopup();
      map.fitBounds(layer.getBounds(), { maxZoom: 17 });
      emitirMudanca();
    }

    function popupCabine(c: CabineOsm) {
      const popup = document.createElement("div");
      popup.className = "space-y-1 text-xs";
      const linha = (texto: string, classe = "") => {
        const p = document.createElement("p");
        p.className = classe;
        p.textContent = texto;
        popup.append(p);
      };
      linha(
        `${c.tipo === "free_flow" ? "Pórtico free flow" : "Cabine de pedágio"}${c.nome ? ` — ${c.nome}` : ""}`,
        "font-medium",
      );
      if (c.operadora) linha(c.operadora);
      if (c.tarifa) linha(`Tarifa no OSM: ${c.tarifa}`);
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "mt-1 rounded bg-indigo-600 px-2 py-1 text-white hover:bg-indigo-700";
      botao.textContent = "Criar polígono aqui";
      botao.addEventListener("click", () => usarCabine(c));
      popup.append(botao);
      return popup;
    }

    // descarta respostas de um movimento anterior que cheguem depois
    let consulta = 0;
    async function carregarCabines() {
      if (map.getZoom() < ZOOM_MIN_CABINES) {
        grupoCabines.clearLayers();
        setCabines({ estado: "longe" });
        return;
      }
      const minha = ++consulta;
      setCabines({ estado: "buscando" });
      const b = map.getBounds();
      const r = await listarCabinesOsm(b.getSouth(), b.getWest(), b.getNorth(), b.getEast());
      if (minha !== consulta || !mapRef.current) return;
      if (r.error) {
        setCabines({ estado: "erro", erro: r.error });
        return;
      }
      grupoCabines.clearLayers();
      for (const c of r.cabines) {
        const cor = c.tipo === "free_flow" ? "#9333ea" : "#ea580c";
        L.circleMarker([c.lat, c.lon], { radius: 7, color: cor, fillColor: cor, fillOpacity: 0.85, weight: 2 })
          .bindPopup(popupCabine(c))
          .addTo(grupoCabines);
      }
      setCabines({ estado: "pronto", qtd: r.cabines.length, truncado: r.truncado });
    }

    if (mostrarCabines) {
      map.on("moveend", carregarCabines);
      carregarCabines();
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !foco) return;
    if (foco.bbox) {
      const [s, n, w, e] = foco.bbox;
      map.fitBounds([[s, w], [n, e]], { maxZoom: 15 });
    } else {
      map.setView([foco.lat, foco.lon], 15);
    }
    focoRef.current?.remove();
    focoRef.current = L.circleMarker([foco.lat, foco.lon], {
      radius: 6,
      color: "#2563eb",
      fillColor: "#2563eb",
      fillOpacity: 0.9,
    })
      .bindTooltip("Resultado da busca")
      .addTo(map);
  }, [foco]);

  return (
    <div className="space-y-1">
      <div
        ref={containerRef}
        className="h-96 w-full rounded-md border border-gray-300 dark:border-gray-600"
      />
      {mostrarCabines && (
        <p className="text-xs text-gray-500 dark:text-gray-400" aria-live="polite">
          {cabines.estado === "longe" && "Aproxime o mapa para ver as cabines de pedágio do OpenStreetMap."}
          {cabines.estado === "buscando" && "Carregando cabines..."}
          {cabines.estado === "pronto" &&
            (cabines.qtd === 0
              ? "Nenhuma cabine do OpenStreetMap nesta área — use a camada Satélite e desenhe à mão."
              : `${cabines.qtd}${cabines.truncado ? "+ (aproxime para ver todas)" : ""} cabine(s) do OpenStreetMap na área: laranja = cabine, roxo = free flow. Clique numa para criar um polígono inicial em volta dela.`)}
          {cabines.estado === "erro" && (
            <span className="text-red-600 dark:text-red-400">
              Não foi possível carregar as cabines ({cabines.erro}).
            </span>
          )}
        </p>
      )}
    </div>
  );
}
