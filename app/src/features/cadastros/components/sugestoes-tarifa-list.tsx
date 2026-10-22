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
  praca_pedagio: { nome: string } | null;
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

function Situacao({ r }: { r: Sugestao }) {
  if (r.valor_eixo_osm === null) {
    return <span className="text-gray-500 dark:text-gray-400">Sem OSM</span>;
  }
  return r.fontes_concordam ? (
    <span className="text-green-700 dark:text-green-400">Concordam</span>
  ) : (
    <span className="text-amber-700 dark:text-amber-400">Divergem</span>
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

  function toggle(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function aprovar(fonte: "fatura" | "osm") {
    if (escolhidas.length === 0) return;
    const rotulo = fonte === "osm" ? "valor do OSM" : "valor da fatura";
    if (
      !window.confirm(
        `Aprovar ${escolhidas.length} sugestão(ões) com o ${rotulo}? As passagens dessas praças serão revalidadas.`,
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
          {
            header: "OSM (por eixo)",
            align: "right",
            render: (r) =>
              r.valor_eixo_osm === null ? (
                "—"
              ) : (
                <span title={r.osm_conferido_em ? `conferido no OSM em ${r.osm_conferido_em}` : "sem data de conferência no OSM"}>
                  {formatBRL(r.valor_eixo_osm)}
                </span>
              ),
          },
          { header: "Situação", render: (r) => <Situacao r={r} /> },
        ]}
      />
    </div>
  );
}
