"use client";

import { useRef, useState } from "react";
import { buscarEndereco, type ResultadoBusca } from "@/lib/geo-osm";
import { Button } from "@/components/ui/button";

// Busca de endereço no Nominatim (OpenStreetMap). Não é um <form> próprio
// (está dentro do form da praça): Enter no campo dispara a busca, não o
// salvar.
export function LocalizarNoMapa({
  sugestoes,
  onEscolher,
}: {
  sugestoes: string[];
  onEscolher: (r: ResultadoBusca) => void;
}) {
  const [texto, setTexto] = useState(sugestoes[0] ?? "");
  const [resultados, setResultados] = useState<ResultadoBusca[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const ultimaBusca = useRef(0);

  async function buscar() {
    const consulta = texto.trim();
    if (!consulta || buscando) return;
    // política de uso do Nominatim: no máximo 1 requisição por segundo
    const espera = 1000 - (Date.now() - ultimaBusca.current);
    if (espera > 0) await new Promise((r) => setTimeout(r, espera));
    setBuscando(true);
    setErro(null);
    setAviso(null);
    try {
      ultimaBusca.current = Date.now();
      let lista = await buscarEndereco(consulta);
      // a rodovia nem sempre está no Nominatim: tenta só a cidade sugerida
      const reserva = sugestoes.find((s) => s !== consulta);
      if (lista.length === 0 && consulta === sugestoes[0] && reserva) {
        await new Promise((r) => setTimeout(r, 1000));
        ultimaBusca.current = Date.now();
        lista = await buscarEndereco(reserva);
        if (lista.length) {
          setTexto(reserva);
          setAviso(`Nada encontrado para "${consulta}" — mostrando "${reserva}".`);
        }
      }
      setResultados(lista);
      if (lista.length === 1) onEscolher(lista[0]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <label
            htmlFor="busca_endereco"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Localizar no mapa
          </label>
          <input
            id="busca_endereco"
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                buscar();
              }
            }}
            placeholder="Endereço, cidade, rodovia..."
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <Button type="button" variant="secondary" disabled={buscando || !texto.trim()} onClick={buscar}>
          {buscando ? "Buscando..." : "Buscar"}
        </Button>
      </div>
      {aviso && <p className="text-xs text-gray-500 dark:text-gray-400">{aviso}</p>}
      {erro && (
        <p className="text-xs text-red-600 dark:text-red-400">
          Não foi possível buscar ({erro}). Tente de novo em instantes.
        </p>
      )}
      {resultados && resultados.length === 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Nenhum resultado. Tente só a cidade e a UF (ex.: &quot;Tatuí, SP&quot;).
        </p>
      )}
      {resultados && resultados.length > 1 && (
        <ul className="divide-y divide-gray-100 rounded-md border border-gray-200 text-sm dark:divide-gray-800 dark:border-gray-700">
          {resultados.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onEscolher(r)}
                className="block w-full px-3 py-2 text-left text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {r.rotulo}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-gray-400 dark:text-gray-500">
        Busca: Nominatim / ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          colaboradores do OpenStreetMap
        </a>
        . Só o texto buscado é enviado.
      </p>
    </div>
  );
}
