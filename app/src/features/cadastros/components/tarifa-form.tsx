"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { salvarTarifa, type FormState } from "../actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { TextField, SelectField } from "@/components/ui/field";
import { formatBRL } from "@/lib/format";

const initialState: FormState = {};

function SubmitButton({ editando }: { editando: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : editando ? "Salvar" : "Adicionar"}
    </Button>
  );
}

type Praca = { id: string; nome: string };

type TarifaExistente = {
  id: string;
  praca_id: string;
  valor_eixo: number;
  vigencia_inicio: string;
  vigencia_fim: string | null;
};

function dataBR(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

// tarifas: todas as cadastradas, mais recente primeiro (listTarifas) — para
// trocar de praça abrir a tarifa dela em vez de mover esta tarifa sem aviso
export function TarifaForm({
  pracas,
  tarifa,
  tarifas = [],
}: {
  pracas: Praca[];
  tarifa?: TarifaExistente;
  tarifas?: TarifaExistente[];
}) {
  const [state, formAction] = useActionState(salvarTarifa, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [pracaId, setPracaId] = useState(tarifa?.praca_id ?? "");

  const maisRecente = new Map<string, TarifaExistente>();
  for (const t of tarifas) if (!maisRecente.has(t.praca_id)) maisRecente.set(t.praca_id, t);
  const daPraca = pracaId ? maisRecente.get(pracaId) : undefined;
  const pracaOriginal = tarifa && pracas.find((p) => p.id === tarifa.praca_id)?.nome;

  function trocarPraca(id: string) {
    setPracaId(id);
    const outra = maisRecente.get(id);
    if (tarifa && id !== tarifa.praca_id && outra) router.push(`/cadastros/tarifas/${outra.id}`);
  }

  useEffect(() => {
    if (state.success && !tarifa) formRef.current?.reset();
  }, [state.success, tarifa]);

  return (
    <form
      ref={formRef}
      action={formAction}
      // reset() acima e o reset automático do form action (React 19) voltam o
      // select ao defaultValue; o aviso da praça acompanha
      onReset={() => setPracaId(tarifa?.praca_id ?? "")}
      className="flex flex-wrap items-end gap-3"
    >
      {tarifa && <input type="hidden" name="tarifa_id" value={tarifa.id} />}
      <SelectField
        id="praca_id"
        name="praca_id"
        label="Praça"
        required
        placeholder="Selecione"
        defaultValue={tarifa?.praca_id}
        onChange={(e) => trocarPraca(e.target.value)}
        options={pracas.map((p) => ({ value: p.id, label: p.nome }))}
      />
      {tarifa && pracaId !== tarifa.praca_id && !daPraca && (
        <p className="w-full text-xs text-amber-700 dark:text-amber-400">
          Esta praça não tem tarifa: ao salvar, esta tarifa sai de {pracaOriginal ?? "sua praça"} e passa
          para ela.
        </p>
      )}
      {tarifa && pracaId !== tarifa.praca_id && daPraca && (
        <p className="w-full text-xs text-gray-500 dark:text-gray-400">Abrindo a tarifa desta praça...</p>
      )}
      {!tarifa && daPraca && (
        <p className="w-full text-xs text-amber-700 dark:text-amber-400">
          Esta praça já tem tarifa: {formatBRL(daPraca.valor_eixo)} por eixo desde{" "}
          {dataBR(daPraca.vigencia_inicio)}
          {daPraca.vigencia_fim ? ` até ${dataBR(daPraca.vigencia_fim)}` : " (sem fim)"} —{" "}
          <Link href={`/cadastros/tarifas/${daPraca.id}`} className="underline">
            abrir
          </Link>
          . Uma nova tarifa precisa começar depois dela.
        </p>
      )}
      <TextField
        id="valor_eixo"
        name="valor_eixo"
        label="Valor por eixo (R$)"
        type="number"
        step="0.01"
        min="0.01"
        required
        defaultValue={tarifa?.valor_eixo}
      />
      <TextField
        id="vigencia_inicio"
        name="vigencia_inicio"
        label="Início da vigência"
        type="date"
        required
        defaultValue={tarifa?.vigencia_inicio}
      />
      <TextField
        id="vigencia_fim"
        name="vigencia_fim"
        label="Fim da vigência"
        type="date"
        defaultValue={tarifa?.vigencia_fim ?? ""}
      />
      <SubmitButton editando={!!tarifa} />
      {state.error && <FormMessage type="error">{state.error}</FormMessage>}
      {state.success && tarifa && (
        <span className="text-xs text-green-600 dark:text-green-400">Salvo</span>
      )}
    </form>
  );
}
