"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { formatBRL, formatNumber, formatPercent } from "@/lib/format";
import {
  BarraProgresso,
  useAvisoAoSair,
  type Progresso,
} from "@/features/importacao/components/progresso-importacao";
import {
  aprovarSugestoesTarifa,
  descartarSugestoesTarifa,
  finalizarAprovacaoSugestoes,
} from "../actions";

type Sugestao = {
  id: string;
  periodo_inicio: string;
  periodo_fim: string;
  valor_eixo_fatura: number;
  passagens_total: number;
  passagens_explicadas: number;
  valor_eixo_osm: number | null;
  osm_conferido_em: string | null;
  fontes_concordam: boolean;
  valor_eixo_antt: number | null;
  antt_coletado_em: string | null;
  antt_concorda: boolean;
  praca_pedagio: { nome: string } | null;
};

type Fonte = "fatura" | "osm" | "antt";

const ROTULO_FONTE: Record<Fonte, string> = {
  fatura: "valor da fatura",
  osm: "valor do OSM",
  antt: "valor da ANTT",
};

// aprovar revalida as passagens da praça; blocos limitados por passagens
// (medido: ~3 ms/passagem, statement_timeout de 8 s)
const PASSAGENS_POR_BLOCO = 400;

function emBlocos(rows: Sugestao[]): Sugestao[][] {
  const blocos: Sugestao[][] = [];
  let atual: Sugestao[] = [];
  let soma = 0;
  for (const r of rows) {
    if (atual.length > 0 && soma + r.passagens_total > PASSAGENS_POR_BLOCO) {
      blocos.push(atual);
      atual = [];
      soma = 0;
    }
    atual.push(r);
    soma += r.passagens_total;
  }
  if (atual.length > 0) blocos.push(atual);
  return blocos;
}

function dataCurta(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

function dataComAno(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano.slice(2)}`;
}

// valor da ANTT + data da coleta; verde quando bate com a fatura (cheio ou −5%)
function Antt({ r }: { r: Sugestao }) {
  if (r.valor_eixo_antt === null) return <span className="text-gray-400">—</span>;
  return (
    <span
      title={
        r.antt_concorda
          ? "Bate com a fatura (valor cheio ou com 5% de TAG)"
          : "Diverge da fatura — a coleta da ANTT pode ser anterior ao último reajuste"
      }
    >
      <span className={r.antt_concorda ? COR_BATE : COR_DIVERGE}>
        {formatBRL(r.valor_eixo_antt)}
      </span>
      {r.antt_coletado_em && (
        <span className="block text-xs text-gray-400">coleta {dataComAno(r.antt_coletado_em)}</span>
      )}
    </span>
  );
}

const COR_BATE = "text-green-700 dark:text-green-400";
const COR_DIVERGE = "text-amber-700 dark:text-amber-400";

// valor do OSM; verde quando concorda com a fatura
function Osm({ r }: { r: Sugestao }) {
  if (r.valor_eixo_osm === null) return <span className="text-gray-400">—</span>;
  return (
    <span
      title={`${r.fontes_concordam ? "Concorda" : "Diverge"} da fatura — ${
        r.osm_conferido_em ? `conferido no OSM em ${r.osm_conferido_em}` : "sem data de conferência no OSM"
      }`}
      className={r.fontes_concordam ? COR_BATE : COR_DIVERGE}
    >
      {formatBRL(r.valor_eixo_osm)}
    </span>
  );
}

export function SugestoesTarifaList({ rows, isAdmin }: { rows: Sugestao[]; isAdmin: boolean }) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [progresso, setProgresso] = useState<Progresso | null>(null);
  const [descartando, setDescartando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const router = useRouter();
  const ocupado = progresso !== null || descartando;
  useAvisoAoSair(progresso !== null);

  const ids = rows.map((r) => r.id);
  const escolhidas = rows.filter((r) => selecionados.has(r.id));
  const todasComOsm = escolhidas.length > 0 && escolhidas.every((r) => r.valor_eixo_osm !== null);
  const todasComAntt = escolhidas.length > 0 && escolhidas.every((r) => r.valor_eixo_antt !== null);

  function toggle(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function aprovar(fonte: Fonte) {
    if (escolhidas.length === 0) return;
    if (
      !window.confirm(
        `Aprovar ${escolhidas.length} sugestão(ões) com o ${ROTULO_FONTE[fonte]}? As passagens dessas praças serão revalidadas.`,
      )
    ) {
      return;
    }
    setErro(null);
    setAviso(null);
    const blocos = emBlocos(escolhidas);
    let aprovadas = 0;
    setProgresso({ enviadas: 0, total: escolhidas.length });
    try {
      for (const bloco of blocos) {
        const resultado = await aprovarSugestoesTarifa(
          bloco.map((r) => r.id),
          fonte,
        );
        if (resultado.error) {
          setErro(
            `${resultado.error}${aprovadas > 0 ? ` (${formatNumber(aprovadas)} já aprovada(s) antes do erro)` : ""}`,
          );
          return;
        }
        aprovadas += resultado.aprovadas ?? 0;
        setProgresso((p) => (p ? { ...p, enviadas: p.enviadas + bloco.length } : p));
      }
      setAviso(`${formatNumber(aprovadas)} tarifa(s) gravada(s) e passagens revalidadas.`);
      setSelecionados(new Set());
    } finally {
      setProgresso(null);
      await finalizarAprovacaoSugestoes();
      router.refresh();
    }
  }

  async function descartar() {
    if (escolhidas.length === 0) return;
    if (!window.confirm(`Descartar ${escolhidas.length} sugestão(ões)?`)) return;
    setErro(null);
    setAviso(null);
    setDescartando(true);
    const resultado = await descartarSugestoesTarifa(escolhidas.map((r) => r.id));
    setDescartando(false);
    if (resultado.error) {
      setErro(resultado.error);
      return;
    }
    setSelecionados(new Set());
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {isAdmin && selecionados.size > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" disabled={ocupado} onClick={() => aprovar("fatura")}>
            Aprovar com valor da fatura ({selecionados.size})
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={ocupado || !todasComOsm}
            title={todasComOsm ? undefined : "Alguma selecionada não tem valor do OSM"}
            onClick={() => aprovar("osm")}
          >
            Aprovar com valor do OSM
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={ocupado || !todasComAntt}
            title={todasComAntt ? undefined : "Alguma selecionada não tem valor da ANTT"}
            onClick={() => aprovar("antt")}
          >
            Aprovar com valor da ANTT
          </Button>
          <Button size="sm" variant="destructive" disabled={ocupado} onClick={descartar}>
            {descartando ? "Descartando..." : "Descartar"}
          </Button>
        </div>
      )}
      {progresso && <BarraProgresso progresso={progresso} unidade="sugestões aprovadas" />}
      {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
      {aviso && <p className="text-sm text-green-600 dark:text-green-400">{aviso}</p>}

      <DataTable
        rows={rows}
        keyField={(row) => row.id}
        emptyMessage="Nenhuma sugestão pendente neste filtro."
        selecao={
          isAdmin
            ? {
                selecionados,
                onToggle: toggle,
                onToggleTodos: () =>
                  setSelecionados((prev) => (prev.size === ids.length ? new Set() : new Set(ids))),
                todosSelecionados: ids.length > 0 && ids.every((id) => selecionados.has(id)),
              }
            : undefined
        }
        columns={[
          { header: "Praça", render: (r) => r.praca_pedagio?.nome ?? "—" },
          {
            header: "Período",
            render: (r) => `${dataCurta(r.periodo_inicio)} a ${dataCurta(r.periodo_fim)}`,
          },
          {
            header: "Fatura (por eixo)",
            align: "right",
            render: (r) => formatBRL(r.valor_eixo_fatura),
          },
          {
            header: "Explica",
            align: "right",
            render: (r) => (
              <span title={`${formatNumber(r.passagens_explicadas)} de ${formatNumber(r.passagens_total)} débitos`}>
                {formatPercent(
                  r.passagens_total ? Math.round((1000 * r.passagens_explicadas) / r.passagens_total) / 10 : 0,
                )}{" "}
                <span className="text-gray-400">de {formatNumber(r.passagens_total)}</span>
              </span>
            ),
          },
          { header: "OSM (por eixo)", align: "right", render: (r) => <Osm r={r} /> },
          { header: "ANTT (por eixo)", align: "right", render: (r) => <Antt r={r} /> },
        ]}
      />
    </div>
  );
}
