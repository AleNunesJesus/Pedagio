import type { ReactNode } from "react";

type ManualSectionProps = {
  id: string;
  titulo: string;
  tags: ReactNode;
  children: ReactNode;
};

/** Moldura padrão de cada seção do manual: âncora, título e selos de papel. */
export function ManualSection({ id, titulo, tags, children }: ManualSectionProps) {
  return (
    <section
      id={id}
      className="scroll-mt-20 border-t border-gray-200 pt-8 first:border-t-0 first:pt-0 dark:border-gray-800"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">{tags}</div>
      <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
        {titulo}
      </h2>
      <div className="max-w-2xl">{children}</div>
    </section>
  );
}
