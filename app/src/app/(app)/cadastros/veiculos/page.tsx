import { getMeuPapel } from "@/lib/auth/guards";
import { listVeiculos, listCategorias } from "@/features/cadastros/queries";
import { VeiculoForm } from "@/features/cadastros/components/veiculo-form";
import { VeiculoList } from "@/features/cadastros/components/veiculo-list";
import { ListaComPainel, PainelNovo } from "@/components/layout/lista-com-painel";
import { GrupoRadio, PainelFiltros } from "@/components/ui/filtros";
import { SelectField } from "@/components/ui/field";
import { contem } from "@/lib/texto";

const FORM_ID = "filtros-veiculos";

type SearchParams = { busca?: string; tipo?: string; categoria?: string; ativo?: string };

export default async function VeiculosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [params, veiculos, categorias, papel] = await Promise.all([
    searchParams,
    listVeiculos(),
    listCategorias(),
    getMeuPapel(),
  ]);

  const porBusca = veiculos.filter((v) => contem(params.busca, v.placa, v.frota));
  const porTipo = (lista: typeof veiculos) => (params.tipo ? lista.filter((v) => v.tipo === params.tipo) : lista);
  const porCategoria = (lista: typeof veiculos) =>
    params.categoria ? lista.filter((v) => v.categoria_veiculo_id === params.categoria) : lista;
  const porAtivo = (lista: typeof veiculos) =>
    params.ativo === "sim" ? lista.filter((v) => v.ativo) : params.ativo === "nao" ? lista.filter((v) => !v.ativo) : lista;

  const baseTipo = porAtivo(porCategoria(porBusca));
  const baseAtivo = porTipo(porCategoria(porBusca));
  const rows = porTipo(baseTipo);

  return (
    <ListaComPainel
      titulo="Veículos e carretas"
      total={rows.length}
      unidade="veículo(s)"
      busca={{ formId: FORM_ID, valor: params.busca, placeholder: "Buscar placa ou frota" }}
      filtros={
        <PainelFiltros id={FORM_ID} limparHref="/cadastros/veiculos">
          <GrupoRadio
            legenda="Tipo"
            name="tipo"
            valor={params.tipo ?? ""}
            opcoes={[
              { value: "", label: "Todos" },
              { value: "cavalo", label: "Cavalo mecânico", qtd: baseTipo.filter((v) => v.tipo === "cavalo").length },
              { value: "carreta", label: "Carreta", qtd: baseTipo.filter((v) => v.tipo === "carreta").length },
            ]}
          />
          <GrupoRadio
            legenda="Situação"
            name="ativo"
            valor={params.ativo ?? ""}
            opcoes={[
              { value: "", label: "Todos" },
              { value: "sim", label: "Ativos", qtd: baseAtivo.filter((v) => v.ativo).length },
              { value: "nao", label: "Inativos", qtd: baseAtivo.filter((v) => !v.ativo).length },
            ]}
          />
          <SelectField
            id="categoria"
            name="categoria"
            label="Categoria"
            placeholder="Todas"
            defaultValue={params.categoria ?? ""}
            options={categorias.map((c) => ({ value: c.id, label: `${c.codigo} — ${c.descricao}` }))}
          />
        </PainelFiltros>
      }
      detalhe={
        papel === "admin" ? (
          <PainelNovo
            titulo="Novo veículo/carreta"
            descricao="Cadastro único para cavalos mecânicos e carretas — a categoria escolhida define os eixos próprios de cada um, usados para calcular a composição real (cavalo + carreta(s)) da viagem."
          >
            {categorias.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Cadastre uma categoria antes de adicionar veículos.
              </p>
            ) : (
              <VeiculoForm categorias={categorias} />
            )}
          </PainelNovo>
        ) : undefined
      }
    >
      <VeiculoList rows={rows} isAdmin={papel === "admin"} />
    </ListaComPainel>
  );
}
