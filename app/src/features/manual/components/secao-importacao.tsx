import { ManualSection } from "@/features/manual/components/manual-section";
import { RoleTag } from "@/features/manual/components/role-tag";
import { Steps } from "@/features/manual/components/steps";
import { Dica } from "@/features/manual/components/callout";

function TabelaFormato({
  colunas,
}: {
  colunas: { nome: string; formato: string; exemplo: string }[];
}) {
  return (
    <div className="mb-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">
              Coluna
            </th>
            <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">
              Formato esperado
            </th>
            <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">
              Exemplo
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {colunas.map((c) => (
            <tr key={c.nome}>
              <td className="px-3 py-2 font-mono text-xs text-gray-900 dark:text-gray-100">
                {c.nome}
              </td>
              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{c.formato}</td>
              <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">
                {c.exemplo}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PASSOS_IMPORTAR = [
  { titulo: "Abra a tela Importação", descricao: "Rota /importacao, no menu superior." },
  {
    titulo: "Escolha o arquivo CSV",
    descricao: "Um clique no campo de arquivo da seção correspondente ao tipo de dado.",
  },
  {
    titulo: "Clique em \"Importar\"",
    descricao:
      "O botão mostra \"Importando...\" enquanto processa. Linhas com erro de formato não são importadas, mas não travam o restante do lote.",
  },
  {
    titulo: "Confira o resultado",
    descricao:
      "Mensagem final do tipo \"Lote importado: N linha(s), N erro(s)\". O lote também aparece no histórico, no fim da página. Se a planilha trouxer uma praça ou estacionamento que não existe no sistema, ele é criado automaticamente com os dados da planilha e listado logo abaixo, num aviso amarelo, para ser completado depois (ver Cadastros › Praças).",
  },
];

export function SecaoImportacao() {
  return (
    <>
      <ManualSection
        id="importar-passagens"
        titulo="Importar passagens"
        tags={<RoleTag role="operador">Todos os perfis</RoleTag>}
      >
        <Steps items={PASSOS_IMPORTAR} />
        <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
          Colunas esperadas no CSV, na ordem do arquivo do fornecedor:
        </p>
        <TabelaFormato
          colunas={[
            { nome: "Número da Fatura", formato: "texto livre", exemplo: "NF-000456" },
            { nome: "Data", formato: "DD/MM/AAAA", exemplo: "05/08/2026" },
            { nome: "Horário", formato: "HH24:MI:SS ou HH24:MI", exemplo: "14:32:00" },
            { nome: "Placa Veículo", formato: "texto", exemplo: "ABC1D23" },
            { nome: "Tipo do veículo", formato: "texto livre, só informativo", exemplo: "Caminhão" },
            {
              nome: "Descrição",
              formato: "nome da praça ou estacionamento; praça não cadastrada é criada como pendente; pode vir vazia em plano contratado",
              exemplo: "Praça KM 45 - BR-101",
            },
            {
              nome: "Tipo de uso",
              formato: "passagem, contrato/plano contratado ou estacionamento",
              exemplo: "passagem",
            },
            {
              nome: "Valor(R$)",
              formato: "formato BR (vírgula decimal), com ou sem R$ — ex.: R$ 10,00 / R$ -10,00; sinal é normalizado pela condição",
              exemplo: "R$ 12,50",
            },
            { nome: "Débito/Crédito", formato: "debito/db ou credito/cr", exemplo: "debito" },
            { nome: "Viagem de Vale Pedágio", formato: "texto livre, opcional", exemplo: "VIAGEM-9" },
            { nome: "Embarcador", formato: "texto livre, opcional", exemplo: "Embarcador X" },
            {
              nome: "Sentido da Praça",
              formato: "obrigatório só em passagem; usado com a Descrição",
              exemplo: "Norte",
            },
          ]}
        />
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Linhas de <strong className="text-gray-900 dark:text-gray-100">estacionamento</strong>{" "}
          são uma cobrança por permanência (ex.: pernoite), não uma passagem
          por praça — o sistema descobre entrada/saída reais cruzando com o
          histórico de GPS. Linhas de{" "}
          <strong className="text-gray-900 dark:text-gray-100">contrato</strong> não
          passam pela validação geoespacial/tarifária.
        </p>
        <Dica>
          Reenviar o mesmo arquivo é seguro: uma linha já importada (mesma
          placa + data/hora + condição + valor) é contada como erro e não
          duplica.
        </Dica>
      </ManualSection>

      <ManualSection
        id="importar-gps"
        titulo="Importar posições de GPS"
        tags={<RoleTag role="operador">Todos os perfis</RoleTag>}
      >
        <TabelaFormato
          colunas={[
            { nome: "placa", formato: "texto", exemplo: "URS4D35" },
            { nome: "latitude", formato: "graus decimais (-90 a 90)", exemplo: "-29.8807867" },
            { nome: "longitude", formato: "graus decimais (-180 a 180)", exemplo: "-51.1899153" },
            { nome: "data", formato: "DD/MM/AAAA", exemplo: "31/08/2026" },
            { nome: "horario", formato: "HH24:MI:SS ou HH24:MI", exemplo: "10:00:20" },
          ]}
        />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          A placa precisa corresponder a um veículo já cadastrado. Pings
          novos revalidam automaticamente as passagens pendentes ou sem
          dados de GPS daquele veículo — não é preciso rodar nada
          manualmente depois de importar.
        </p>
      </ManualSection>

      <ManualSection
        id="importar-viagens"
        titulo="Importar viagens (documento fiscal)"
        tags={<RoleTag role="operador">Todos os perfis</RoleTag>}
      >
        <TabelaFormato
          colunas={[
            { nome: "placa", formato: "texto", exemplo: "UGF9B40" },
            { nome: "numero_transporte", formato: "texto livre, único", exemplo: "26232" },
            { nome: "cidade_origem / uf_origem", formato: "texto", exemplo: "PORTO ALEGRE / RS" },
            { nome: "cidade_destino / uf_destino", formato: "texto", exemplo: "SÃO PAULO / SP" },
            {
              nome: "data_hora_saida",
              formato: "DD/MM/AAAA HH24:MI",
              exemplo: "30/08/2026 10:00",
            },
            {
              nome: "data_hora_chegada",
              formato: "mesmo formato de data_hora_saida",
              exemplo: "01/09/2026 18:00",
            },
            {
              nome: "carreta1 / carreta2",
              formato: "placa/código da carreta, opcional",
              exemplo: "ABC1234",
            },
            { nome: "tipo_viagem", formato: "carregado ou vazio", exemplo: "CARREGADO" },
          ]}
        />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Não existe coluna de embarcador nesse arquivo — o sistema descobre
          o embarcador cruzando placa e janela de saída/chegada com as
          passagens de pedágio do mesmo veículo naquele período.
        </p>
      </ManualSection>

      <ManualSection
        id="historico-importacoes"
        titulo="Histórico de importações"
        tags={
          <>
            <RoleTag role="operador">Ver histórico</RoleTag>
            <RoleTag role="admin">Excluir lotes</RoleTag>
          </>
        }
      >
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          No final da tela Importação, lista os últimos lotes importados
          (Tipo, Arquivo, Usuário, Linhas, Erros, Data).
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Excluir um lote apaga todas as linhas que vieram daquele arquivo
          (passagens, posições de GPS ou viagens, conforme o tipo) e pede
          confirmação — não pode ser desfeito.
        </p>
      </ManualSection>
    </>
  );
}
