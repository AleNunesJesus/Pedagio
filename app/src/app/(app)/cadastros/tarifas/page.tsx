import Link from "next/link";
import { getMeuPapel } from "@/lib/auth/guards";
import { listTarifas, listPracas, contarSugestoesTarifaPendentes } from "@/features/cadastros/queries";
import { TarifaForm } from "@/features/cadastros/components/tarifa-form";
import { TarifaList } from "@/features/cadastros/components/tarifa-list";
import { ListaComPainel, PainelNovo } from "@/components/layout/lista-com-painel";
import { GrupoRadio, PainelFiltros } from "@/components/ui/filtros";
import { formatNumber } from "@/lib/format";
import { contem } from "@/lib/texto";

const FORM_ID = "filtros-tarifas";

type SearchParams = { busca?: string; vigencia?: string; origem?: string };

// vigente = sem fim ou com fim a partir de hoje
function vigente(fim: string | null, hoje: string) {
  return fim === null || fim >= hoje;
}

export default async function TarifasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [params, tarifas, pracas, sugestoesPendentes, papel] = await Promise.all([
    searchParams,
    listTarifas(),
    listPracas(),
    contarSugestoesTarifaPendentes(),
    getMeuPapel(),
  ]);
  const hoje = new Date().toISOString().slice(0, 10);

  const porBusca = tarifas.filter((t) => contem(params.busca, t.praca_pedagio?.nome));
  const porVigencia = (lista: typeof tarifas) =>
    params.vigencia === "vigente"
      ? lista.filter((t) => vigente(t.vigencia_fim, hoje))
      : params.vigencia === "encerrada"
        ? lista.filter((t) => !vigente(t.vigencia_fim, hoje))
        : lista;
  const porOrigem = (lista: typeof tarifas) =>
    params.origem ? lista.filter((t) => t.origem === params.origem) : lista;

  const baseVigencia = porOrigem(porBusca);
  const baseOrigem = porVigencia(porBusca);
  const rows = porOrigem(baseOrigem);

  return (
    <ListaComPainel
      titulo="Tarifas"
      total={rows.length}
      unidade="tarifa(s)"
      busca={{ formId: FORM_ID, valor: params.busca, placeholder: "Buscar praça" }}
      filtros={
        <PainelFiltros id={FORM_ID} limparHref="/cadastros/tarifas">
          <GrupoRadio
            legenda="Vigência"
            name="vigencia"
            valor={params.vigencia ?? ""}
            opcoes={[
              { value: "", label: "Todas" },
              { value: "vigente", label: "Vigentes", qtd: baseVigencia.filter((t) => vigente(t.vigencia_fim, hoje)).length },
              { value: "encerrada", label: "Encerradas", qtd: baseVigencia.filter((t) => !vigente(t.vigencia_fim, hoje)).length },
            ]}
          />
          <GrupoRadio
            legenda="Origem"
            name="origem"
            valor={params.origem ?? ""}
            opcoes={[
              { value: "", label: "Todas" },
              { value: "manual", label: "Manual", qtd: baseOrigem.filter((t) => t.origem !== "sugestao").length },
              { value: "sugestao", label: "Sugestão aprovada", qtd: baseOrigem.filter((t) => t.origem === "sugestao").length },
            ]}
          />
          <Link
            href="/cadastros/tarifas/sugestoes"
            className="block rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900"
          >
            Sugestões de tarifa
            {sugestoesPendentes > 0 && ` (${formatNumber(sugestoesPendentes)} pendentes)`} →
          </Link>
        </PainelFiltros>
      }
      detalhe={
        papel === "admin" ? (
          <PainelNovo
            titulo="Nova tarifa"
            descricao="A tarifa é o valor por eixo da praça. A validação aceita a cobrança de todos os eixos da composição ou de menos eixos (eixos suspensos), com ou sem 5% de desconto de TAG."
          >
            {pracas.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Cadastre ao menos uma praça antes de definir tarifas.
              </p>
            ) : (
              <TarifaForm pracas={pracas} tarifas={tarifas} />
            )}
          </PainelNovo>
        ) : undefined
      }
    >
      <TarifaList rows={rows} isAdmin={papel === "admin"} />
    </ListaComPainel>
  );
}
