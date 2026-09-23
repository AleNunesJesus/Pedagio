import { ManualSection } from "@/features/manual/components/manual-section";
import { RoleTag } from "@/features/manual/components/role-tag";

export function SecaoAdministracao() {
  return (
    <ManualSection
      id="usuarios"
      titulo="Usuários"
      tags={<RoleTag role="admin">Somente admin</RoleTag>}
    >
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Rota <code>/usuarios</code>, visível e acessível apenas para Admin.
        Lista todos os usuários que já entraram no sistema pelo menos uma
        vez (e-mail e papel atual) — não existe convite/criação de usuário
        por aqui, só atribuição de papel a quem já tem conta.
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Para cada linha, um seletor de papel (Sem acesso, Operador, Admin) e
        um botão &quot;Salvar&quot;. Definir &quot;Sem acesso&quot; revoga o
        acesso imediatamente na próxima página que o usuário abrir — é assim
        que se remove o acesso de alguém, não existe um botão de exclusão de
        usuário separado.
      </p>
    </ManualSection>
  );
}
