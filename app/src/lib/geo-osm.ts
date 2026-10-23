import { UFS, UF_POR_ESTADO } from "./ufs";

// FASE 25: busca de endereço no Nominatim (OpenStreetMap), chamada direto do
// navegador — só o texto da busca sai do sistema — e polígono inicial em volta
// de uma cabine do instantâneo cabine_osm.

export type ResultadoBusca = {
  id: number;
  rotulo: string;
  lat: number;
  lon: number;
  // [sul, norte, oeste, leste]
  bbox: [number, number, number, number] | null;
  endereco: string;
  municipio: string | null;
  uf: string | null;
};

type NominatimItem = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  boundingbox?: [string, string, string, string];
  address?: Record<string, string>;
};

// display_name sem país, CEP-região e "Região ..." (mesorregiões que o
// Nominatim intercala e que não ajudam a identificar o lugar)
function enderecoLimpo(displayName: string): string {
  return displayName
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p && p !== "Brasil" && !/^Região\b/i.test(p))
    .join(", ");
}

export async function buscarEndereco(texto: string, signal?: AbortSignal): Promise<ResultadoBusca[]> {
  const params = new URLSearchParams({
    q: texto,
    format: "jsonv2",
    addressdetails: "1",
    countrycodes: "br",
    limit: "6",
    "accept-language": "pt-BR",
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal });
  if (!res.ok) throw new Error(`Nominatim respondeu ${res.status}`);
  const itens = (await res.json()) as NominatimItem[];
  return itens.map((i) => {
    const a = i.address ?? {};
    // nem todo resultado traz o código ISO do estado (ex.: "Itu, SP"): cai para o nome
    const uf = (a["ISO3166-2-lvl4"] ?? "").replace(/^BR-/, "") || UF_POR_ESTADO[a.state ?? ""] || null;
    const bb = i.boundingbox?.map(Number) as [number, number, number, number] | undefined;
    const endereco = enderecoLimpo(i.display_name);
    return {
      id: i.place_id,
      rotulo: endereco,
      lat: Number(i.lat),
      lon: Number(i.lon),
      bbox: bb && bb.every(Number.isFinite) ? bb : null,
      endereco,
      municipio: a.city ?? a.town ?? a.municipality ?? a.village ?? null,
      uf,
    };
  });
}

const UFS_SET = new Set(UFS);
const SENTIDOS = /^(NORTE|SUL|LESTE|OESTE|CRESCENTE|DECRESCENTE|ASCENDENTE|DESCENDENTE|NORTE\/SUL|SUL\/NORTE|LESTE\/OESTE|OESTE\/LESTE|DUPLO|AMBOS)$/i;

function normalizarRodovia(texto: string): string | null {
  const m = texto.replace(/\s+/g, "").match(/^([A-Z]{2})-?0*(\d{1,3})$/i);
  return m ? `${m[1].toUpperCase()}-${m[2].padStart(3, "0")}` : null;
}

// abreviações comuns nos nomes da fatura ("S. B. DO CAMPO", "PRES. BERNARDES")
function expandirAbreviacoes(texto: string): string {
  return texto
    .replace(/\bS\.\s*B\.(?=\s|$)/gi, "São Bernardo")
    .replace(/\bS\.\s*J\.\s*(?=Boa Vista)/gi, "São João da ")
    .replace(/\bS\.\s*J\.\s*(?=Rio Preto|dos Campos)/gi, "São José ")
    .replace(/\bPRES\.\s*/gi, "Presidente ")
    .replace(/\bSTA\.\s*/gi, "Santa ")
    .replace(/\bSTO\.\s*/gi, "Santo ")
    .replace(/\bS\.\s*/g, "São ")
    .replace(/\s+(AUX|AUXILIAR)$/i, "");
}

function capitalizar(texto: string): string {
  return expandirAbreviacoes(texto)
    .toLowerCase()
    .replace(/(^|\s)(\p{L})/gu, (_, esp: string, l: string) => esp + l.toUpperCase())
    .replace(/\b(Da|De|Do|Das|Dos|E)\b/g, (p) => p.toLowerCase());
}

// Sugestão de busca a partir do nome da praça vindo da fatura. Formatos
// reais: "SP021, KM25+360, SUL, SÃO PAULO", "BR101, KM079+300, NORTE,
// ARAQUARI - SC", "SERRA KM 239,5 - NORTE", "ENCANTADO - KM 93,9 DESCENDENTE".
// Devolve [busca completa, busca só da cidade] — o Nominatim nem sempre acha
// a rodovia dentro da cidade.
export function sugerirBusca(nome: string, rodoviaCadastro?: string | null): string[] {
  // vírgula seguida de dígito é decimal do km ("KM 93,9"), não separador
  const partes = nome.split(/,(?!\d)/).map((p) => p.trim()).filter(Boolean);
  let rodovia = rodoviaCadastro ? normalizarRodovia(rodoviaCadastro) ?? rodoviaCadastro : null;
  let cidade: string | null = null;
  let uf: string | null = null;

  if (partes.length > 1) {
    for (const p of partes) {
      const r = normalizarRodovia(p);
      if (r && !rodovia) rodovia = r;
    }
    const resto = partes.filter((p) => !normalizarRodovia(p) && !/^KM\b/i.test(p) && !SENTIDOS.test(p));
    let ultima = resto.at(-1) ?? null;
    const sufixoUf = ultima?.match(/^(.*?)\s*-\s*([A-Z]{2})$/);
    if (sufixoUf && UFS_SET.has(sufixoUf[2])) {
      ultima = sufixoUf[1];
      uf = sufixoUf[2];
    }
    cidade = ultima;
  } else {
    cidade = nome.replace(/\bKM\b.*$/i, "").replace(/[-–]\s*$/, "").trim() || null;
  }

  if (!uf && rodovia && !rodovia.startsWith("BR") && UFS_SET.has(rodovia.slice(0, 2))) uf = rodovia.slice(0, 2);
  if (cidade && /^(F\.?\s*FLOW|FREE\s*FLOW)$/i.test(cidade)) cidade = null;
  const cidadeUf = [cidade ? capitalizar(cidade) : null, uf].filter(Boolean).join(", ");

  const sugestoes: string[] = [];
  if (rodovia && cidadeUf) sugestoes.push(`${rodovia}, ${cidadeUf}`);
  if (cidadeUf) sugestoes.push(cidadeUf);
  if (!sugestoes.length && rodovia) sugestoes.push(rodovia);
  return sugestoes;
}

// Cabine/pórtico do instantâneo do OpenStreetMap (tabela cabine_osm)
export type CabineOsm = {
  osm_id: number;
  lat: number;
  lon: number;
  tipo: "cabine" | "free_flow";
  nome: string | null;
  operadora: string | null;
  tarifa: string | null;
  // sentido de circulação em graus (0 = norte), da tag direction
  rumo: number | null;
};

// Polígono inicial em volta da cabine: retângulo de 600 m ao longo da pista
// × 240 m de largura; sem direção conhecida, quadrado de 450 m.
export function poligonoEmVolta(c: { lat: number; lon: number; rumo: number | null }): {
  type: "Polygon";
  coordinates: number[][][];
} {
  const mLat = 110_540;
  const mLon = 111_320 * Math.cos((c.lat * Math.PI) / 180);
  const [meioComp, meioLarg] = c.rumo === null ? [225, 225] : [300, 120];
  const r = ((c.rumo ?? 0) * Math.PI) / 180;
  const u = { x: Math.sin(r), y: Math.cos(r) };
  const v = { x: u.y, y: -u.x };
  const canto = (a: number, b: number) => {
    const x = a * meioComp * u.x + b * meioLarg * v.x;
    const y = a * meioComp * u.y + b * meioLarg * v.y;
    return [c.lon + x / mLon, c.lat + y / mLat];
  };
  const anel = [canto(1, 1), canto(1, -1), canto(-1, -1), canto(-1, 1)];
  return { type: "Polygon", coordinates: [[...anel, anel[0]]] };
}
