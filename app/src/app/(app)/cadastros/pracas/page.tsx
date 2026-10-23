import { getMeuPapel } from "@/lib/auth/guards";
import { listPracas } from "@/features/cadastros/queries";
import { PracaList } from "@/features/cadastros/components/praca-list";
import { ListaComPainel } from "@/components/layout/lista-com-painel";
import { GrupoRadio, PainelFiltros } from "@/components/ui/filtros";
import { SelectField } from "@/components/ui/field";
import { LinkButton } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { formatNumber } from "@/lib/format";
import { contem } from "@/lib/texto";

const SEM_UF = "sem";
const FORM_ID = "filtros-pracas";

type SearchParams = { busca?: string; uf?: string; cadastro?: string };

export default async function PracasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [params, pracas, papel] = await Promise.all([searchParams, listPracas(), getMeuPapel()]);
  const pendentes = pracas.filter((p) => p.cadastro_pendente).length;

  // cada contagem considera os outros filtros, não o próprio
  const porBusca = pracas.filter((p) => contem(params.busca, p.nome, p.rodovia, p.municipio));
  const porCadastro = (lista: typeof pracas) =>
    params.cadastro === "pendente"
      ? lista.filter((p) => p.cadastro_pendente)
      : params.cadastro === "completo"
        ? lista.filter((p) => !p.cadastro_pendente)
        : lista;
  const porUf = (lista: typeof pracas) =>
    params.uf ? lista.filter((p) => (p.uf ?? SEM_UF) === params.uf) : lista;

  // filtro por UF só com as UFs que existem no cadastro
  const contagemUf = new Map<string, number>();
  for (const p of porCadastro(porBusca)) {
    const chave = p.uf ?? SEM_UF;
    contagemUf.set(chave, (contagemUf.get(chave) ?? 0) + 1);
  }
  const ufs = [...contagemUf.keys()].filter((u) => u !== SEM_UF).sort();
  if (contagemUf.has(SEM_UF)) ufs.push(SEM_UF);

  const baseCadastro = porUf(porBusca);
  const rows = porCadastro(baseCadastro);

  return (
    <ListaComPainel
      titulo="Praças"
      total={rows.length}
      unidade="praça(s)"
      busca={{ formId: FORM_ID, valor: params.busca, placeholder: "Buscar nome, rodovia ou município" }}
      acoes={papel === "admin" && <LinkButton href="/cadastros/pracas/nova">Nova praça</LinkButton>}
      filtros={
        <PainelFiltros id={FORM_ID} limparHref="/cadastros/pracas">
          <GrupoRadio
            legenda="Cadastro"
            name="cadastro"
            valor={params.cadastro ?? ""}
            opcoes={[
              { value: "", label: "Todos" },
              {
                value: "pendente",
                label: "Pendente (sem polígono)",
                qtd: baseCadastro.filter((p) => p.cadastro_pendente).length,
                corQtd: "font-semibold text-amber-700 dark:text-amber-400",
              },
              { value: "completo", label: "Completo", qtd: baseCadastro.filter((p) => !p.cadastro_pendente).length },
            ]}
          />
          <SelectField
            id="uf"
            name="uf"
            label="UF"
            placeholder="Todas"
            defaultValue={params.uf ?? ""}
            options={ufs.map((u) => ({
              value: u,
              label: `${u === SEM_UF ? "Sem UF" : u} (${formatNumber(contagemUf.get(u) ?? 0)})`,
            }))}
          />
        </PainelFiltros>
      }
    >
      {pendentes > 0 && (
        <div className="mb-3">
          <Alert variant="warning">
            {formatNumber(pendentes)} praça(s) criada(s) automaticamente pela importação da fatura,
            só com nome e sentido da planilha. Até o polígono ser desenhado, as passagens dessas
            praças ficam como &quot;Sem cadastro&quot;.{" "}
            {papel === "admin"
              ? "Abra cada uma para completar o cadastro — a busca \"Localizar no mapa\" e as cabines do OpenStreetMap ajudam a achar o local; ao salvar, as passagens são revalidadas."
              : "Peça a um administrador para completar o cadastro."}
          </Alert>
        </div>
      )}
      <PracaList rows={rows} isAdmin={papel === "admin"} />
    </ListaComPainel>
  );
}
