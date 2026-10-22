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
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Quando a fatura importada traz uma praça que ainda não existe
          (nome + sentido), o sistema cria a praça sozinho, só com esses
          dois campos, e marca como{" "}
          <strong className="text-gray-900 dark:text-gray-100">Cadastro pendente</strong>{" "}
          na lista (aviso também no Painel). As passagens dela ficam como
          &quot;Sem cadastro&quot; até alguém abrir a praça, desenhar o
          polígono e salvar — aí elas são revalidadas na hora. Cadastrar a
          tarifa depois também revalida as passagens. Evite renomear a praça
          criada assim: o nome e o sentido são o que reconhece a praça na
          próxima fatura. O mesmo vale para estacionamentos (só o nome).
        </p>
      </ManualSection>

      <ManualSection id="cadastros-tarifas" titulo="Tarifas" tags={TAGS_CADASTRO}>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Valor por eixo da praça, com período de vigência. Campos: Praça,
          Valor por eixo (R$), Início da vigência e Fim da vigência
          (opcional — em aberto significa tarifa &quot;vigente&quot;, sem
          data de fim). Não é permitido cadastrar duas tarifas com vigência
          sobreposta para a mesma praça.
        </p>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Na validação, o valor cobrado é dividido pela tarifa por eixo para
          saber quantos eixos foram cobrados, aceitando também o valor com
          5% de desconto de TAG. Todos os eixos da composição (cavalo +
          carreta(s)) é <strong className="text-gray-900 dark:text-gray-100">Eixos completos</strong>;
          menos eixos (caminhão vazio com eixos suspensos) é{" "}
          <strong className="text-gray-900 dark:text-gray-100">Eixos suspensos</strong> — os
          dois sem divergência. Mais eixos do que a composição tem (
          <strong className="text-gray-900 dark:text-gray-100">Eixos a maior</strong>) ou um
          valor que não é múltiplo da tarifa (
          <strong className="text-gray-900 dark:text-gray-100">Valor fora da tarifa</strong>)
          viram divergência contra a tarifa cheia da composição. Créditos
          (vale-pedágio do embarcador) não são conferidos contra a tarifa.
        </p>
      </ManualSection>

      <ManualSection
        id="cadastros-sugestoes-tarifa"
        titulo="Sugestões de tarifa"
        tags={TAGS_CADASTRO}
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Rota <code>/cadastros/tarifas/sugestoes</code>. O admin informa um
          período e o sistema sugere, para cada praça sem tarifa nesse
          período, o valor por eixo que explica o maior número de débitos
          das faturas, ao lado da tarifa publicada no OpenStreetMap
          (mantida por voluntários, pode estar desatualizada). Filtros:
          Fatura e OSM concordam, Divergem, Sem OSM, Todas. Ao aprovar
          (com o valor da fatura ou do OSM), a tarifa é gravada a partir do
          início do período — fechando a tarifa anterior da praça, se
          houver — e as passagens da praça são revalidadas; acompanhe a
          barra de progresso e não feche a aba. Descartar só tira a
          sugestão da lista. Gerar de novo refaz todas as sugestões
          pendentes.
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
