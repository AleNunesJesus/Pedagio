import { ManualSection } from "@/features/manual/components/manual-section";
import { RoleTag } from "@/features/manual/components/role-tag";

const TAGS_CADASTRO = (
  <>
    <RoleTag role="operador">Consultar</RoleTag>
    <RoleTag role="admin">Consultar e editar</RoleTag>
  </>
);

export function SecaoCadastros() {
  return (
    <>
      <ManualSection id="cadastros-categorias" titulo="Categorias" tags={TAGS_CADASTRO}>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Categoria tarifária por quantidade de eixos, usada tanto no
          cadastro de veículos quanto na busca da tarifa. Campos: Código,
          Descrição, Quantidade de eixos. Não é possível excluir uma
          categoria em uso por veículos, tarifas ou passagens validadas.
        </p>
      </ManualSection>

      <ManualSection id="cadastros-veiculos" titulo="Veículos" tags={TAGS_CADASTRO}>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Cadastro único para cavalos mecânicos e carretas — a categoria
          escolhida define os eixos próprios de cada um, usados para
          calcular a composição real (cavalo + carreta(s)) da viagem.
          Campos: Placa, Tipo (Cavalo mecânico/Carreta), Categoria (eixos
          próprios), Categoria de fallback de tarifa (só para cavalo
          mecânico — usada quando a composição real da viagem não é
          conhecida), Frota (opcional) e Ativo. Não é possível excluir um
          veículo/carreta com passagens, posições de GPS ou viagens de
          transporte vinculadas.
        </p>
      </ManualSection>

      <ManualSection id="cadastros-pracas" titulo="Praças" tags={TAGS_CADASTRO}>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Praça de pedágio. Campos: Nome, Rodovia, Concessionária, Km,
          Sentido, Ativa e a área da praça, desenhada num mapa (ferramenta
          de polígono no canto superior direito do mapa — só um polígono
          por praça; desenhar um novo substitui o anterior). O polígono é
          obrigatório para salvar e é o que o motor de validação usa para
          conferir se o veículo realmente esteve na praça. Não é possível
          excluir uma praça com tarifas ou passagens vinculadas.
        </p>
      </ManualSection>

      <ManualSection id="cadastros-tarifas" titulo="Tarifas" tags={TAGS_CADASTRO}>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Valor cobrado por praça + categoria de veículo, com período de
          vigência. Campos: Praça, Categoria, Valor (R$), Início da
          vigência e Fim da vigência (opcional — em aberto significa
          tarifa &quot;vigente&quot;, sem data de fim). Não é permitido
          cadastrar duas tarifas com vigência sobreposta para a mesma praça
          e categoria.
        </p>
      </ManualSection>

      <ManualSection
        id="cadastros-estacionamentos"
        titulo="Estacionamentos"
        tags={TAGS_CADASTRO}
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Local com cobrança por permanência (pernoite/diárias). Campos:
          Nome, Ativo e a área do estacionamento desenhada no mapa (mesmo
          editor de polígono das Praças). Não é possível excluir um
          estacionamento com tarifas ou passagens vinculadas.
        </p>
      </ManualSection>

      <ManualSection
        id="cadastros-tarifas-estacionamento"
        titulo="Tarifas estacionamento"
        tags={TAGS_CADASTRO}
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Valor da diária de um estacionamento, também com período de
          vigência. Campos: Estacionamento, Valor da diária (R$), Início da
          vigência e Fim da vigência (opcional). Mesma regra de não
          sobrepor vigências para o mesmo estacionamento.
        </p>
      </ManualSection>

      <ManualSection id="cadastros-embarcadores" titulo="Embarcadores" tags={TAGS_CADASTRO}>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Embarcadores são criados automaticamente ao importar passagens
          com crédito vinculado a uma viagem — não há cadastro manual. O
          único campo editável é o CNPJ. Não é possível excluir um
          embarcador com passagens ou viagens de transporte vinculadas.
        </p>
      </ManualSection>
    </>
  );
}
