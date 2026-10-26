"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { finalizarAprovacaoSugestoes, gerarSugestoesTarifa } from "../actions";
import { aprovarEmBlocos } from "../aprovacao-sugestoes";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { TextField } from "@/components/ui/field";
import {
  BarraProgresso,
  useAvisoAoSair,
  type Progresso,
} from "@/features/importacao/components/progresso-importacao";
import { formatNumber } from "@/lib/format";

// FASE 28 (ajuste): gerar e, em seguida, gravar em Tarifas as sugestões
// confirmadas por fonte independente (fatura = ANTT ou fatura = OSM); as
// demais ficam pendentes para revisão. onSubmit (não form action): o reset do
// form do React 19 limparia as datas.
export function GerarSugestoesForm({ inicio, fim }: { inicio: string; fim: string }) {
  const [gerando, startTransition] = useTransition();
  const [progresso, setProgresso] = useState<Progresso | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const router = useRouter();
  const ocupado = gerando || progresso !== null;
  useAvisoAoSair(progresso !== null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    const de = String(dados.get("inicio") ?? "").trim();
    const ate = String(dados.get("fim") ?? "").trim();
    setErro(null);
    setAviso(null);

    startTransition(async () => {
      const gerado = await gerarSugestoesTarifa(de, ate);
      if (gerado.error) {
        setErro(gerado.error);
        return;
      }
      const confirmadas = gerado.confirmadas ?? [];
      const geradas = gerado.geradas ?? 0;
      if (confirmadas.length === 0) {
        setAviso(`${formatNumber(geradas)} sugestão(ões) gerada(s); nenhuma confirmada pela ANTT ou pelo OSM.`);
        router.refresh();
        return;
      }

      let gravadas = 0;
      setProgresso({ enviadas: 0, total: confirmadas.length });
      const avancar = (qtd: number) => setProgresso((p) => (p ? { ...p, enviadas: p.enviadas + qtd } : p));
      try {
        for (const fonte of ["antt", "fatura"] as const) {
          const grupo = confirmadas.filter((c) => c.fonte === fonte);
          if (grupo.length === 0) continue;
          const r = await aprovarEmBlocos(grupo, fonte, avancar);
          gravadas += r.aprovadas;
          if (r.error) {
            setErro(`${r.error} (${formatNumber(gravadas)} tarifa(s) gravada(s) antes do erro)`);
            return;
          }
        }
        setAviso(
          `${formatNumber(geradas)} sugestão(ões) gerada(s): ${formatNumber(gravadas)} confirmada(s) pela ANTT ou pelo OSM gravada(s) em Tarifas; ${formatNumber(geradas - gravadas)} pendente(s) para revisão.`,
        );
      } finally {
        setProgresso(null);
        await finalizarAprovacaoSugestoes();
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <TextField id="inicio" name="inicio" label="Passagens de" type="date" required defaultValue={inicio} />
        <TextField id="fim" name="fim" label="até" type="date" required defaultValue={fim} />
        <Button type="submit" disabled={ocupado}>
          {progresso ? "Gravando..." : gerando ? "Gerando..." : "Gerar sugestões"}
        </Button>
      </div>
      {progresso && <BarraProgresso progresso={progresso} unidade="tarifas gravadas" />}
      {erro && <FormMessage type="error">{erro}</FormMessage>}
      {aviso && <p className="text-sm text-green-600 dark:text-green-400">{aviso}</p>}
    </form>
  );
}
