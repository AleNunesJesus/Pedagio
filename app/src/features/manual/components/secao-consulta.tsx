import { ManualSection } from "@/features/manual/components/manual-section";
import { RoleTag } from "@/features/manual/components/role-tag";

export function SecaoConsulta() {
  return (
    <>
      <ManualSection
        id="painel"
        titulo="Painel"
        tags={<RoleTag role="operador">Todos os perfis</RoleTag>}
      >
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Rota <code>/dashboard</code> — visão geral de todo o período
          importado, sem filtro de data. É uma tela só de leitura, dividida
          em blocos:
        </p>
        <ul className="list-disc space-y-2 pl-5 text-sm text-gray-600 dark:text-gray-400">
          <li>
            <strong className="text-gray-900 dark:text-gray-100">Cartões no topo:</strong>{" "}
            Praças cadastradas, Veículos cadastrados, Total cobrado,
            Divergência total.
          </li>
          <li>
            <strong className="text-gray-900 dark:text-gray-100">Divergência:</strong>{" "}
            três tabelas — por causa (status de validação), e onde se
            concentra (top 5 praças e top 5 veículos com maior desvio em
            módulo).
          </li>
          <li>
            <strong className="text-gray-900 dark:text-gray-100">Financeiro:</strong>{" "}
            gráfico &quot;Cobrado vs. esperado por mês&quot;, gráfico
            &quot;Gasto por praça&quot; (top 10) e tabela &quot;Gasto por
            veículo/mês&quot; (top 10).
          </li>
          <li>
            <strong className="text-gray-900 dark:text-gray-100">
              Passagens por tipo de uso:
            </strong>{" "}
            totais e quantidades de passagens x contratos, e gráfico de
            valores por mês.
          </li>
          <li>
            <strong className="text-gray-900 dark:text-gray-100">
              Passagens por vínculo de viagem:
            </strong>{" "}
            totais e quantidades por viagem carregada, vazia ou sem vínculo
            identificado (só sobre passagens reais).
          </li>
          <li>
            <strong className="text-gray-900 dark:text-gray-100">
              Crédito x débito (viagem/embarcador):
            </strong>{" "}
            resumo com link para a tela{" "}
            <a href="#credito-debito" className="text-indigo-600 hover:underline dark:text-indigo-400">
              Crédito x débito
            </a>
            , incluindo a subseção &quot;Crédito sem débito
            correspondente&quot; (valor em aberto).
          </li>
          <li>
            <strong className="text-gray-900 dark:text-gray-100">
              Auditoria / Validação:
            </strong>{" "}
            passagens por status, tendência diária de passagens sem dados de
            GPS, praças com maior taxa de &quot;fora do polígono&quot; e
            veículos com maior taxa de divergência.
          </li>
          <li>
            <strong className="text-gray-900 dark:text-gray-100">Operacional:</strong>{" "}
            volume de passagens por dia e diferença média de tempo entre o
            ping de GPS e o horário da passagem, por praça.
          </li>
        </ul>
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Os gráficos e tabelas não têm drill-down por clique, exceto os
          links explícitos que levam à tela de Crédito x débito.
        </p>
      </ManualSection>

      <ManualSection
        id="faturas"
        titulo="Faturas"
        tags={<RoleTag role="operador">Todos os perfis</RoleTag>}
      >
        <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          Lista de faturas
        </h3>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Rota <code>/faturas</code>. Filtro por Período de / Período até.
          Colunas: Fatura (link para o detalhe; &quot;Sem fatura&quot;
          quando não há número), Período inicial, Período final, Passagens,
          Contrato, Estacionamento, Valor total e Situação (bolinha verde
          &quot;OK&quot; quando não há pendência, ou bolinha amarela
          &quot;N pendente(s)&quot;).
        </p>
        <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          Detalhe da fatura
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Rota <code>/faturas/[número]</code>. Mostra cartões (Período
          inicial, Período final, Valor total a pagar, Valor passagens,
          Valor contrato, Valor estacionamento, Total de linhas), o card
          &quot;Situação das passagens&quot; (contagem por status de
          validação presente na fatura), duas tabelas lado a lado (Valor por
          praça e Valor por veículo) e, ao final, a lista completa das
          passagens daquela fatura.
        </p>
      </ManualSection>

      <ManualSection
        id="passagens"
        titulo="Passagens"
        tags={
          <>
            <RoleTag role="operador">Consultar</RoleTag>
            <RoleTag role="admin">Consultar e excluir</RoleTag>
          </>
        }
      >
        <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          Lista de passagens
        </h3>
        <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
          Rota <code>/passagens</code>. Filtros: Status, Praça, Veículo,
          Tipo de uso (Passagem/Contrato/Estacionamento), Conferência por
          eixo (Eixos completos, Eixos suspensos, Eixos a maior, Valor fora
          da tarifa, Sem tarifa), Embarcador, Viagem (texto), De / Até.
        </p>
        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-gray-600 dark:text-gray-400">
          <li>Fatura, Data/hora, Placa, Frota, Praça (ou estacionamento), Tipo.</li>
          <li>
            <strong className="text-gray-900 dark:text-gray-100">Categoria</strong> —
            código da categoria tarifária usada; quando estimada a partir do
            cadastro do veículo (e não da composição real cavalo +
            carreta(s) da viagem), aparece com &quot;(estimado)&quot; e um
            aviso explicando a origem.
          </li>
          <li>
            <strong className="text-gray-900 dark:text-gray-100">
              Viagem (transporte)
            </strong>{" "}
            — vínculo com a viagem de transporte: número da viagem quando
            vinculado (com &quot;(nº não confere)&quot; se o número da
            fatura não bate com o do sistema de transporte),
            &quot;Ambíguo (N)&quot; quando há mais de uma viagem candidata
            no mesmo horário, ou &quot;—&quot; sem vínculo.
          </li>
          <li>
            Valor cobrado,{" "}
            <strong className="text-gray-900 dark:text-gray-100">Eixos</strong> — eixos
            cobrados / eixos da composição (com &quot;TAG&quot; quando veio com
            desconto; em vermelho quando são mais eixos que a composição ou o
            valor não é múltiplo da tarifa) — e Status (link para o detalhe).
          </li>
        </ul>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Admin pode selecionar linhas e excluí-las em lote — é a única ação
          de escrita disponível nesta tela.
        </p>
        <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          Detalhe da passagem
        </h3>
        <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
          Rota <code>/passagens/[id]</code>. Mostra os dados informados na
          fatura e o resultado da validação:
        </p>
        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-gray-600 dark:text-gray-400">
          <li>
            <strong className="text-gray-900 dark:text-gray-100">Estacionamento:</strong>{" "}
            entrada e saída detectadas por GPS, diárias detectadas, valor
            esperado (diárias × tarifa vigente) e divergência de valor.
          </li>
          <li>
            <strong className="text-gray-900 dark:text-gray-100">
              Praça de pedágio:
            </strong>{" "}
            se o veículo estava dentro do polígono da praça, distância até o
            polígono, diferença de tempo entre GPS e passagem, categoria
            usada na tarifa e sua origem (composição da viagem ou cadastro
            do veículo), conferência por eixo (ex.: &quot;Eixos suspensos — 4
            de 7 eixos, TAG −5%&quot;), valor esperado, divergência de valor
            e vínculo com a viagem de transporte.
          </li>
        </ul>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Quando aplicável, um mapa mostra o polígono da praça e o ponto de
          GPS usado na validação (verde = dentro, vermelho = fora, cinza =
          sem dado de posição). Sem polígono cadastrado ou em passagens de
          estacionamento, o mapa não aparece.
        </p>
      </ManualSection>

      <ManualSection
        id="credito-debito"
        titulo="Crédito x débito"
        tags={<RoleTag role="operador">Todos os perfis</RoleTag>}
      >
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Rota <code>/credito-debito</code>. Compara, por viagem e
          embarcador, o quanto o embarcador creditou (adiantamento) contra o
          quanto a praça debitou de fato — só considera passagens reais com
          viagem e embarcador identificados.
        </p>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Filtros: Embarcador, Viagem (texto) e Situação (&quot;Crédito e
          débito&quot;, &quot;Só crédito (sem débito)&quot;, &quot;Só débito
          (sem crédito)&quot;). Colunas: Viagem, Embarcador, Situação, Qtd.
          créditos, Creditado, Qtd. débitos, Debitado e Diferença.
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Não há tela de detalhe própria; a linha não é clicável.
        </p>
      </ManualSection>

      <ManualSection
        id="viagens"
        titulo="Viagens"
        tags={
          <>
            <RoleTag role="operador">Consultar</RoleTag>
            <RoleTag role="admin">Consultar e excluir</RoleTag>
          </>
        }
      >
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Rota <code>/viagens-transporte</code> — lista as viagens de
          transporte importadas a partir do documento fiscal (ver{" "}
          <a href="#importar-viagens" className="text-indigo-600 hover:underline dark:text-indigo-400">
            Importação
          </a>
          ). O número de transporte é uma numeração diferente da
          &quot;viagem&quot; informada na fatura de pedágio.
        </p>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Busca no topo (número do transporte ou placa) e filtros na lateral
          esquerda: Saída de / Saída até, Tipo (Carregado/Vazio),
          Divergência (cobrado a mais, a menos ou sem divergência),
          Embarcador e Veículo. Ao lado de cada opção de Tipo e Divergência
          aparece quantas viagens ela traria com os outros filtros atuais.
        </p>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Colunas: Transporte (bolinha índigo = carregado, cinza = vazio),
          Placa, Rota, Saída, Pedágios e Divergência (vermelho = cobrado a
          mais que a tarifa, verde = a menos).
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Clique numa viagem para abrir o painel de detalhe à direita:
          embarcador, frota, saída e chegada, valor cobrado (com a parte
          estimada — passagem que cai na janela da viagem mas sem
          confirmação por GPS dentro do polígono da praça), tarifa,
          divergência e a lista de pedágios da viagem com o status de cada
          um. Clicar num pedágio abre o detalhe da passagem.
        </p>
      </ManualSection>

      <ManualSection
        id="rastreamento"
        titulo="Rastreamento"
        tags={
          <>
            <RoleTag role="operador">Consultar</RoleTag>
            <RoleTag role="admin">Consultar e excluir</RoleTag>
          </>
        }
      >
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Rota <code>/rastreamento</code> — trajeto de GPS de um único
          veículo num período. Filtros: Veículo (obrigatório para exibir
          qualquer coisa), De, Até.
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Com um veículo selecionado, mostra um mapa (trajeto em linha azul,
          pontos em círculo azul e o ping mais recente em vermelho, com
          horário ao clicar) e, abaixo, a lista das posições (Data/hora,
          Latitude, Longitude, Fonte — &quot;Arquivo&quot; ou
          &quot;API&quot;). O mapa é somente leitura — não mostra polígonos
          de praça/estacionamento, só o trajeto do veículo.
        </p>
      </ManualSection>
    </>
  );
}
