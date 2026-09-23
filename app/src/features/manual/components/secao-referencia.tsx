import { ManualSection } from "@/features/manual/components/manual-section";
import { RoleTag } from "@/features/manual/components/role-tag";
import { ValorSinalizado } from "@/components/ui/valor-sinalizado";
import { STATUS, STATUS_VALIDACAO_INFO } from "@/lib/status-validacao";
import { FluxoGeral } from "@/features/manual/components/fluxo-geral";

const PERMISSOES: { acao: string; operador: string | boolean; admin: boolean }[] = [
  { acao: "Consultar Painel, Faturas, Passagens, Crédito x débito, Viagens, Rastreamento", operador: true, admin: true },
  { acao: "Importar planilhas (passagens, GPS, viagens)", operador: true, admin: true },
  { acao: "Excluir passagens, viagens, posições de GPS", operador: false, admin: true },
  { acao: "Excluir lote de importação", operador: false, admin: true },
  { acao: "Consultar Cadastros (categorias, veículos, praças, tarifas, estacionamentos, embarcadores)", operador: true, admin: true },
  { acao: "Criar, editar ou excluir Cadastros e Tarifas", operador: false, admin: true },
  { acao: "Editar CNPJ de embarcador", operador: false, admin: true },
  { acao: "Gerenciar papel dos usuários", operador: false, admin: true },
];

function Celula({ valor }: { valor: string | boolean }) {
  if (valor === true) {
    return (
      <td className="px-3 py-2 text-center font-semibold text-green-600 dark:text-green-400">
        ✓
      </td>
    );
  }
  if (valor === false) {
    return (
      <td className="px-3 py-2 text-center text-gray-300 dark:text-gray-700">—</td>
    );
  }
  return (
    <td className="px-3 py-2 text-center text-xs text-gray-500 dark:text-gray-400">
      {valor}
    </td>
  );
}

export function SecaoReferencia() {
  return (
    <>
      <ManualSection
        id="fluxo-validacao"
        titulo="Fluxo geral"
        tags={<RoleTag role="operador">Referência</RoleTag>}
      >
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Recapitulando o fluxo já apresentado em{" "}
          <a href="#como-funciona" className="text-blue-600 hover:underline dark:text-blue-400">
            Primeiros passos
          </a>
          : importação das três planilhas, validação automática (geoespacial
          + tarifária + vínculo com a viagem de transporte) e o resultado
          disponível nas telas de consulta.
        </p>
        <FluxoGeral />
      </ManualSection>

      <ManualSection
        id="status-validacao"
        titulo="Status de validação"
        tags={<RoleTag role="operador">Referência</RoleTag>}
      >
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Aparece nas telas de Passagens, Faturas e no Painel, sempre com a
          mesma bolinha colorida:
        </p>
        <ul className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
          {Object.entries(STATUS_VALIDACAO_INFO).map(([chave, info]) => (
            <li key={chave} className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 flex-none rounded-full"
                style={{ backgroundColor: STATUS[info.role] }}
                aria-hidden
              />
              <span>{info.label}</span>
            </li>
          ))}
        </ul>
      </ManualSection>

      <ManualSection
        id="valor-sinalizado"
        titulo="Valor sinalizado"
        tags={<RoleTag role="operador">Referência</RoleTag>}
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Usado em &quot;Divergência&quot; e em &quot;Diferença&quot;
          (crédito x débito): <ValorSinalizado valor={1} /> é sempre
          desfavorável (cobrado a mais que a tarifa, ou praça debitando mais
          do que o embarcador creditou); <ValorSinalizado valor={-1} /> é
          sempre favorável; zero é neutro.
        </p>
      </ManualSection>

      <ManualSection
        id="permissoes"
        titulo="Quem pode fazer o quê"
        tags={<RoleTag role="operador">Referência</RoleTag>}
      >
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">
                  Ação
                </th>
                <th className="px-3 py-2 text-center font-medium text-gray-500 dark:text-gray-400">
                  Operador
                </th>
                <th className="px-3 py-2 text-center font-medium text-gray-500 dark:text-gray-400">
                  Admin
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {PERMISSOES.map((linha) => (
                <tr key={linha.acao}>
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                    {linha.acao}
                  </td>
                  <Celula valor={linha.operador} />
                  <Celula valor={linha.admin} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ManualSection>
    </>
  );
}
