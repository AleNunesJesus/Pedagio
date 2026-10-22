"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import {
  finalizarImportacaoPassagens,
  iniciarImportacaoPassagens,
  importarBlocoPassagens,
  type ImportacaoState,
} from "../actions";
import {
  COLUNAS_PLANILHA_PASSAGENS,
  TAMANHO_BLOCO_PASSAGENS,
  cabecalhosFaltando,
  chaveCabecalho,
  decodificarArquivo,
  linhaParaStaging,
  numerarOcorrencias,
} from "../planilha-passagens";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Alert } from "@/components/ui/alert";
import { formatNumber } from "@/lib/format";
import { BarraProgresso, ErrosPorMotivo, useAvisoAoSair, type Progresso } from "./progresso-importacao";

// O arquivo é lido aqui no navegador e vai ao servidor em blocos (FASE 23) —
// uma fatura de um mês tem dezenas de milhares de linhas, acima do limite de
// 1 MB por Server Action e do tempo máximo de uma chamada ao banco.
export function ImportarForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [progresso, setProgresso] = useState<Progresso | null>(null);
  const [resultado, setResultado] = useState<ImportacaoState>({});
  const importando = progresso !== null;

  useAvisoAoSair(importando);

  async function importar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const arquivo = (e.currentTarget.elements.namedItem("arquivo") as HTMLInputElement).files?.[0];
    if (!arquivo || arquivo.size === 0) {
      setResultado({ error: "Selecione um arquivo CSV." });
      return;
    }

    setResultado({});
    setProgresso({ enviadas: 0, total: 0 });
    try {
      const texto = decodificarArquivo(new Uint8Array(await arquivo.arrayBuffer()));
      // separador detectado automaticamente: o Excel em português exporta com ";"
      const lido = Papa.parse<Record<string, string>>(texto, {
        header: true,
        skipEmptyLines: true,
        transformHeader: chaveCabecalho,
      });
      if (lido.errors.length > 0) {
        setResultado({ error: `Erro ao ler o CSV (linha ${(lido.errors[0].row ?? 0) + 2}): ${lido.errors[0].message}` });
        return;
      }
      const faltando = cabecalhosFaltando(lido.meta.fields ?? []);
      if (faltando.length > 0) {
        setResultado({
          error:
            `Cabeçalho(s) não encontrado(s) no arquivo: ${faltando.join(", ")}. ` +
            `Esperado, nesta ordem: ${COLUNAS_PLANILHA_PASSAGENS.map((c) => c.cabecalho).join(", ")}.`,
        });
        return;
      }
      if (lido.data.length === 0) {
        setResultado({ error: "O arquivo não tem nenhuma linha de dados." });
        return;
      }

      const linhas = numerarOcorrencias(lido.data.map(linhaParaStaging));
      setProgresso({ enviadas: 0, total: linhas.length });

      const inicio = await iniciarImportacaoPassagens(arquivo.name);
      if (!inicio.loteId) {
        setResultado({ error: inicio.error ?? "Não foi possível criar o lote." });
        return;
      }

      for (let i = 0; i < linhas.length; i += TAMANHO_BLOCO_PASSAGENS) {
        const bloco = linhas.slice(i, i + TAMANHO_BLOCO_PASSAGENS);
        const res = await importarBlocoPassagens(inicio.loteId, bloco);
        if (res.error) {
          setResultado({
            error:
              `A importação parou em ${formatNumber(i)} de ${formatNumber(linhas.length)} linhas: ${res.error} ` +
              "O lote ficou parcial no histórico abaixo — exclua esse lote e importe o arquivo de novo.",
          });
          return;
        }
        setProgresso({ enviadas: i + bloco.length, total: linhas.length });
      }

      setResultado(await finalizarImportacaoPassagens(inicio.loteId));
      formRef.current?.reset();
    } catch (err) {
      setResultado({
        error:
          `Falha inesperada na importação: ${err instanceof Error ? err.message : String(err)}. ` +
          "Se um lote parcial aparecer no histórico, exclua-o e importe de novo.",
      });
    } finally {
      setProgresso(null);
    }
  }

  const criados = resultado.cadastrosCriados ?? [];
  const totalPracas = resultado.totalCadastrosCriados?.pracas ?? 0;
  const totalEstacionamentos = resultado.totalCadastrosCriados?.estacionamentos ?? 0;
  const totalCriados = totalPracas + totalEstacionamentos;

  return (
    <form ref={formRef} onSubmit={importar} className="space-y-3">
      <div>
        <label
          htmlFor="arquivo"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Arquivo CSV
        </label>
        <input
          id="arquivo"
          name="arquivo"
          type="file"
          accept=".csv,text/csv"
          required
          disabled={importando}
          className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200 dark:text-gray-300 dark:file:bg-gray-800 dark:file:text-gray-300"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Cabeçalhos esperados, nesta ordem: Número da Fatura, Data (DD/MM/AAAA), Horário
          (HH24:MI ou HH24:MI:SS), Placa Veículo, Tipo do veículo, Descrição (nome da praça ou
          estacionamento), Tipo de uso (passagens, plano contratado, estacionamento, adesão,
          outras taxas, crédito plano contratado), Valor(R$) (ex.: R$ 10,00 ou R$ -10,00),
          Débito/Crédito, Viagem de Vale Pedágio, Embarcador, Sentido da Praça. Separador vírgula
          ou ponto e vírgula, sem limite de linhas. Veja o Manual.
        </p>
      </div>

      <Button type="submit" disabled={importando}>
        {importando ? "Importando..." : "Importar"}
      </Button>

      {progresso && <BarraProgresso progresso={progresso} />}

      {resultado.error && <FormMessage type="error">{resultado.error}</FormMessage>}

      {resultado.lote && (
        <FormMessage type="success">
          Lote importado: {formatNumber(resultado.lote.total_linhas)} linha(s),{" "}
          {formatNumber(resultado.lote.total_erros)} não importada(s).
        </FormMessage>
      )}

      <ErrosPorMotivo erros={resultado.errosPorMotivo} />

      {totalCriados > 0 && (
        <Alert variant="warning">
          <p>
            {formatNumber(totalCriados)} cadastro(s) não existiam e foram criados automaticamente com
            os dados da planilha
            {totalPracas > 0 && totalEstacionamentos > 0
              ? ` (${formatNumber(totalPracas)} praça(s) e ${formatNumber(totalEstacionamentos)} estacionamento(s))`
              : ""}
            . As passagens deles ficam como &quot;Sem cadastro&quot; até o polígono ser desenhado:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {criados.map((c) => (
              <li key={`${c.tipo}-${c.nome}-${c.sentido ?? ""}`}>
                {c.tipo === "praca" ? "Praça" : "Estacionamento"} {c.nome}
                {c.sentido ? ` (sentido ${c.sentido})` : ""}
              </li>
            ))}
            {totalCriados > criados.length && (
              <li>e mais {formatNumber(totalCriados - criados.length)}…</li>
            )}
          </ul>
          <p className="mt-1">
            Ajuste em{" "}
            {totalPracas > 0 && (
              <Link href="/cadastros/pracas" className="underline">
                Cadastros › Praças
              </Link>
            )}
            {totalPracas > 0 && totalEstacionamentos > 0 && " e "}
            {totalEstacionamentos > 0 && (
              <Link href="/cadastros/estacionamentos" className="underline">
                Cadastros › Estacionamentos
              </Link>
            )}
            .
          </p>
        </Alert>
      )}
    </form>
  );
}
