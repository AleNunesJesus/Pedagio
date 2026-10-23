import Link from "next/link";
import { ManualSection } from "@/features/manual/components/manual-section";
import { RoleTag } from "@/features/manual/components/role-tag";
import { Steps } from "@/features/manual/components/steps";
import { Dica } from "@/features/manual/components/callout";
import { Alert } from "@/components/ui/alert";
import { ValorSinalizado } from "@/components/ui/valor-sinalizado";
import { FluxoGeral } from "@/features/manual/components/fluxo-geral";

export function SecaoPrimeirosPassos() {
  return (
    <>
      <ManualSection
        id="entrar"
        titulo="Entrar no sistema"
        tags={<RoleTag role="operador">Todos os perfis</RoleTag>}
      >
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          O sistema concilia as passagens de pedágio informadas pelo
          fornecedor (planilha da fatura) contra a posição real dos veículos
          (GPS) e contra a tarifa por eixo vigente de cada praça, para
          identificar cobranças indevidas ou com valor divergente.
        </p>
        <Steps
          items={[
            {
              titulo: "Acesse a tela de login",
              descricao: "Informe o e-mail e a senha da sua conta.",
            },
            {
              titulo: "Credenciais inválidas",
              descricao:
                "\"E-mail ou senha inválidos.\" é a mensagem para qualquer erro de login — propositalmente genérica, não indica qual dos dois está errado.",
            },
            {
              titulo: "Você é levado ao Painel",
              descricao: "A tela inicial (/dashboard) mostra a visão geral de todo o período importado.",
            },
          ]}
        />
        <Dica>
          Se a sessão expirar em algum ponto do sistema, você volta ao login
          com o aviso &quot;Sua sessão expirou. Faça login novamente.&quot;
        </Dica>
      </ManualSection>

      <ManualSection
        id="como-funciona"
        titulo="Como o sistema funciona"
        tags={<RoleTag role="operador">Todos os perfis</RoleTag>}
      >
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Três planilhas alimentam o sistema. A partir delas, uma validação
          automática confere cada passagem contra o GPS do veículo e contra a
          tarifa vigente, e o resultado fica disponível nas telas de consulta
          e conciliação:
        </p>
        <FluxoGeral />
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          A validação roda sozinha assim que os dados chegam — não existe um
          botão &quot;validar&quot; para clicar. Se um dado chegar depois
          (ex.: GPS de um veículo importado após a passagem), a passagem
          afetada é revalidada automaticamente. O detalhe de cada etapa da
          validação (geoespacial, tarifária e vínculo com a viagem de
          transporte) está em{" "}
          <a href="#fluxo-validacao" className="text-indigo-600 hover:underline dark:text-indigo-400">
            Referência rápida
          </a>
          .
        </p>
      </ManualSection>

      <ManualSection
        id="acesso-pendente"
        titulo="Acesso pendente"
        tags={<RoleTag role="operador">Todos os perfis</RoleTag>}
      >
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Entrar com e-mail e senha válidos autentica você, mas não é
          suficiente para usar o sistema — um administrador ainda precisa
          atribuir um papel à sua conta.
        </p>
        <Alert variant="warning" className="mb-3">
          <strong>Sem papel definido.</strong> Enquanto isso não acontece,
          toda tentativa de acesso cai na tela &quot;Acesso pendente&quot;:
          &quot;Sua conta ainda não tem um papel definido neste sistema.
          Peça a um administrador para liberar seu acesso.&quot; A única
          ação disponível ali é &quot;Sair&quot;.
        </Alert>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Assim que um admin atribuir seu papel em{" "}
          <Link href="/usuarios" className="text-indigo-600 hover:underline dark:text-indigo-400">
            Usuários
          </Link>
          , a próxima página que você abrir já libera o acesso normal.
        </p>
      </ManualSection>

      <ManualSection
        id="papeis"
        titulo="Papéis de acesso"
        tags={<RoleTag role="operador">Todos os perfis</RoleTag>}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-800">
            <p className="mb-1.5 font-medium text-gray-900 dark:text-gray-100">
              Operador
            </p>
            <p className="text-gray-500 dark:text-gray-400">
              Consulta todas as telas e importa planilhas. Não cria, edita
              ou exclui cadastros, tarifas, passagens, viagens ou posições de
              GPS. O menu Usuários não aparece.
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-800">
            <p className="mb-1.5 font-medium text-gray-900 dark:text-gray-100">
              Admin
            </p>
            <p className="text-gray-500 dark:text-gray-400">
              Acesso total: além de consultar e importar, cria, edita e
              exclui cadastros/tarifas, exclui passagens/viagens/posições e
              lotes de importação, e gerencia o papel dos demais usuários.
            </p>
          </div>
        </div>
      </ManualSection>

      <ManualSection
        id="convencoes"
        titulo="Convenções gerais"
        tags={<RoleTag role="operador">Todos os perfis</RoleTag>}
      >
        <ul className="list-disc space-y-2 pl-5 text-sm text-gray-600 dark:text-gray-400">
          <li>
            <strong className="text-gray-900 dark:text-gray-100">Filtros</strong>{" "}
            ficam guardados na própria URL da página — dá para favoritar ou
            compartilhar um link já filtrado. O botão &quot;Limpar&quot;
            remove todos os filtros aplicados.
          </li>
          <li>
            <strong className="text-gray-900 dark:text-gray-100">Listas</strong>{" "}
            são paginadas em blocos de 50 itens, com &quot;Página X de
            Y&quot; e links &quot;← Anterior&quot; / &quot;Próxima →&quot;
            que preservam os filtros ativos.
          </li>
          <li>
            <strong className="text-gray-900 dark:text-gray-100">
              Valores com sinal
            </strong>{" "}
            (divergência, diferença de crédito/débito) sempre mostram o
            sinal e a cor: positivo (<ValorSinalizado valor={1} />) é
            desfavorável, negativo (<ValorSinalizado valor={-1} />) é
            favorável — nunca só a cor, o sinal também aparece no texto.
            Detalhes em{" "}
            <a href="#valor-sinalizado" className="text-indigo-600 hover:underline dark:text-indigo-400">
              Referência rápida
            </a>
            .
          </li>
          <li>
            O botão de sol/lua no canto superior direito alterna entre tema
            claro e escuro; a preferência fica salva no navegador.
          </li>
          <li>Não há exportação para CSV/Excel/PDF em nenhuma tela.</li>
        </ul>
      </ManualSection>
    </>
  );
}
