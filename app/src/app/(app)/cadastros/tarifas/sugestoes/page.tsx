import { getMeuPapel } from "@/lib/auth/guards";
import { listSugestoesTarifa, getPeriodoPassagens } from "@/features/cadastros/queries";
import { GerarSugestoesForm } from "@/features/cadastros/components/gerar-sugestoes-form";
import { SugestoesTarifaList } from "@/features/cadastros/components/sugestoes-tarifa-list";
import { ListaComPainel, PainelNovo } from "@/components/layout/lista-com-painel";
import { GrupoRadio, PainelFiltros } from "@/components/ui/filtros";
import { STATUS } from "@/lib/status-validacao";
import { contem } from "@/lib/texto";

const FORM_ID = "filtros-sugestoes";

const FILTROS = [
  { valor: "concordam", label: "Fatura e OSM concordam", cor: STATUS.good },
  { valor: "divergem", label: "Divergem", cor: STATUS.serious },
  { valor: "sem_osm", label: "Sem OSM", cor: STATUS.neutral },
  { valor: "todas", label: "Todas" },
] as const;

type Filtro = (typeof FILTROS)[number]["valor"];

// FASE 28: segunda dimensão, contra a tarifa publicada pela ANTT
const FILTROS_ANTT = [
  { valor: "todas", label: "Todas" },
  { valor: "bate", label: "Fatura = ANTT", cor: STATUS.good },
  { valor: "diverge", label: "Fatura ≠ ANTT", cor: STATUS.serious },
  { valor: "sem", label: "Sem ANTT", cor: STATUS.neutral },
] as const;

type FiltroAntt = (typeof FILTROS_ANTT)[number]["valor"];

export default async function SugestoesTarifaPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; antt?: string; busca?: string }>;
}) {
  const { filtro: filtroParam, antt: anttParam, busca } = await searchParams;
  const filtro: Filtro = FILTROS.some((f) => f.valor === filtroParam) ? (filtroParam as Filtro) : "concordam";
  const filtroAntt: FiltroAntt = FILTROS_ANTT.some((f) => f.valor === anttParam) ? (anttParam as FiltroAntt) : "todas";

  const [sugestoes, papel, periodo] = await Promise.all([
    listSugestoesTarifa(),
    getMeuPapel(),
    getPeriodoPassagens(),
  ]);

  const situacao = (s: (typeof sugestoes)[number]): Filtro =>
    s.valor_eixo_osm === null ? "sem_osm" : s.fontes_concordam ? "concordam" : "divergem";
  const situacaoAntt = (s: (typeof sugestoes)[number]): FiltroAntt =>
    s.valor_eixo_antt === null ? "sem" : s.antt_concorda ? "bate" : "diverge";
  const porOsm = (s: (typeof sugestoes)[number], f: Filtro) => f === "todas" || situacao(s) === f;
  const porAntt = (s: (typeof sugestoes)[number], f: FiltroAntt) => f === "todas" || situacaoAntt(s) === f;
  const base = sugestoes.filter((s) => contem(busca, s.praca_pedagio?.nome));
  // cada grupo conta dentro do que o outro grupo já filtrou
  const contagem = (f: Filtro) => base.filter((s) => porAntt(s, filtroAntt) && porOsm(s, f)).length;
  const contagemAntt = (f: FiltroAntt) => base.filter((s) => porOsm(s, filtro) && porAntt(s, f)).length;
  const rows = base.filter((s) => porOsm(s, filtro) && porAntt(s, filtroAntt));

  return (
    <ListaComPainel
      titulo="Sugestões de tarifa"
      total={rows.length}
      unidade="sugestão(ões)"
      busca={{ formId: FORM_ID, valor: busca, placeholder: "Buscar praça" }}
      filtros={
        <PainelFiltros id={FORM_ID} limparHref="/cadastros/tarifas/sugestoes">
          <GrupoRadio
            legenda="Situação"
            name="filtro"
            valor={filtro}
            opcoes={FILTROS.map((f) => ({
              value: f.valor,
              label: f.label,
              cor: "cor" in f ? f.cor : undefined,
              qtd: contagem(f.valor),
            }))}
          />
          <GrupoRadio
            legenda="ANTT (praças federais)"
            name="antt"
            valor={filtroAntt}
            opcoes={FILTROS_ANTT.map((f) => ({
              value: f.valor,
              label: f.label,
              cor: "cor" in f ? f.cor : undefined,
              qtd: contagemAntt(f.valor),
            }))}
          />
        </PainelFiltros>
      }
      detalhe={
        <div className="space-y-6">
          {papel === "admin" && (
            <PainelNovo
              titulo="Gerar sugestões"
              descricao="Refaz todas as sugestões pendentes a partir dos débitos do período."
            >
              <GerarSugestoesForm inicio={periodo.inicio} fim={periodo.fim} />
            </PainelNovo>
          )}
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p>
              Para cada praça sem tarifa no período, o valor por eixo que explica o maior número de
              débitos das faturas (todos os eixos ou eixos suspensos, com ou sem 5% de TAG), comparado
              com a tarifa publicada no OpenStreetMap e, nas praças federais, com a tarifa da ANTT.
              Aprovar grava a tarifa a partir do início do período e revalida as passagens da praça.
            </p>
            <p className="text-xs">
              Tarifas da ANTT: painel público &quot;Tarifas Vigentes&quot; do{" "}
              <a
                href="https://www.gov.br/antt/pt-br"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                portal de rodovias da ANTT
              </a>
              , copiado por script — a data é a da coleta da ANTT, que nem sempre acompanha o último
              reajuste.
            </p>
            <p className="text-xs">
              Tarifas do OpenStreetMap: ©{" "}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                colaboradores do OpenStreetMap
              </a>{" "}
              (ODbL) — mantidas por voluntários, podem estar desatualizadas.
            </p>
          </div>
        </div>
      }
    >
      <SugestoesTarifaList key={`${filtro}-${filtroAntt}-${busca ?? ""}`} rows={rows} isAdmin={papel === "admin"} />
    </ListaComPainel>
  );
}
