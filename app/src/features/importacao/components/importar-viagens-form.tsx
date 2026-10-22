"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import {
  finalizarImportacaoViagens,
  iniciarImportacaoViagens,
  importarBlocoViagens,
  type ImportacaoState,
} from "../actions";
import { chaveCabecalho, decodificarArquivo } from "../planilha-passagens";
import {
  COLUNAS_PLANILHA_VIAGENS,
  TAMANHO_BLOCO_VIAGENS,
  cabecalhosFaltandoViagens,
  linhaViagemParaStaging,
} from "../planilha-viagens";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { formatNumber } from "@/lib/format";
import { BarraProgresso, ErrosPorMotivo, useAvisoAoSair, type Progresso } from "./progresso-importacao";

// Mesmo fluxo das passagens (FASE 23): lê no navegador e envia em blocos —
// numa chamada só, 4.981 viagens já passavam do tempo máximo do banco.
export function ImportarViagensForm() {
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
      const lido = Papa.parse<Record<string, string>>(texto, {
        header: true,
        skipEmptyLines: true,
        transformHeader: chaveCabecalho,
      });
      if (lido.errors.length > 0) {
        setResultado({ error: `Erro ao ler o CSV (linha ${(lido.errors[0].row ?? 0) + 2}): ${lido.errors[0].message}` });
        return;
      }
      const faltando = cabecalhosFaltandoViagens(lido.meta.fields ?? []);
      if (faltando.length > 0) {
        setResultado({
          error:
            `Cabeçalho(s) não encontrado(s) no arquivo: ${faltando.join(", ")}. ` +
            `Esperado: ${COLUNAS_PLANILHA_VIAGENS.map((c) => c.cabecalho).join(", ")}.`,
        });
        return;
      }
      if (lido.data.length === 0) {
        setResultado({ error: "O arquivo não tem nenhuma linha de dados." });
        return;
      }

      const linhas = lido.data.map(linhaViagemParaStaging);
      setProgresso({ enviadas: 0, total: linhas.length });

      const inicio = await iniciarImportacaoViagens(arquivo.name);
      if (!inicio.loteId) {
        setResultado({ error: inicio.error ?? "Não foi possível criar o lote." });
        return;
      }

      for (let i = 0; i < linhas.length; i += TAMANHO_BLOCO_VIAGENS) {
        const bloco = linhas.slice(i, i + TAMANHO_BLOCO_VIAGENS);
        const res = await importarBlocoViagens(inicio.loteId, bloco);
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

      setResultado(await finalizarImportacaoViagens(inicio.loteId));
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

  return (
    <form ref={formRef} onSubmit={importar} className="space-y-3">
      <div>
        <label
          htmlFor="arquivo-viagens"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Arquivo CSV
        </label>
        <input
          id="arquivo-viagens"
          name="arquivo"
          type="file"
          accept=".csv,text/csv"
          required
          disabled={importando}
          className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200 dark:text-gray-300 dark:file:bg-gray-800 dark:file:text-gray-300"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Cabeçalhos esperados: placa, numero_transporte, cidade_origem,
          uf_origem, cidade_destino, uf_destino, data_hora_saida,
          data_hora_chegada (DD/MM/AAAA HH24:MI), carreta1, carreta2,
          tipo_viagem (carregado/vazio). Sem limite de linhas. O embarcador é
          descoberto cruzando com as passagens de pedágio do período —
          inclusive as importadas depois. Veja o Manual.
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
    </form>
  );
}
