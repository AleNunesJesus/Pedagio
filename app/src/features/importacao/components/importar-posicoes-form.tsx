"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import {
  buscarLotePosicoesIncompleto,
  descartarPendentesPosicoes,
  finalizarImportacaoPosicoes,
  iniciarImportacaoPosicoes,
  importarBlocoPosicoes,
  progressoLotePosicoes,
  revalidarBlocoPosicoes,
  type ImportacaoState,
} from "../actions";
import { chaveCabecalho, decodificarArquivo } from "../planilha-passagens";
import {
  COLUNAS_PLANILHA_POSICOES,
  TAMANHO_BLOCO_POSICOES,
  TAMANHO_BLOCO_REVALIDACAO,
  cabecalhosFaltandoPosicoes,
  linhaPosicaoParaStaging,
} from "../planilha-posicoes";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { formatNumber } from "@/lib/format";
import { BarraProgresso, ErrosPorMotivo, useAvisoAoSair, type Progresso } from "./progresso-importacao";

type Fase = "posicoes" | "revalidacao";

// um bloco leva ~2 s; sem resposta em 2 min, a chamada é dada como perdida
const TEMPO_LIMITE_MS = 120_000;
const MAX_FALHAS_SEGUIDAS = 5;

function comTempoLimite<T>(promessa: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("tempo esgotado")), ms);
    promessa.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Depois de uma falha: espera um bloco que ainda esteja rodando terminar
// (staging do lote esvazia). Se sobrarem linhas na staging paradas por 30 s,
// são de um bloco que falhou antes de processar (cada chamada ao banco tem
// limite de 8 s) — descarta e reenvia a partir da última linha contada.
async function sincronizar(loteId: string): Promise<number> {
  let anterior = "";
  let paradoDesde = Date.now();
  for (;;) {
    const p = await progressoLotePosicoes(loteId).catch(() => ({ error: "sem resposta" }) as const);
    if ("processadas" in p && p.processadas !== undefined) {
      if (!p.pendentes) return p.processadas;
      const agora = `${p.processadas}/${p.pendentes}`;
      if (agora !== anterior) {
        anterior = agora;
        paradoDesde = Date.now();
      } else if (Date.now() - paradoDesde > 30_000) {
        await descartarPendentesPosicoes(loteId);
        return p.processadas;
      }
    }
    await esperar(3000);
  }
}

// FASE 27: mesmo fluxo das passagens e viagens — lê no navegador e envia em
// blocos, sem limite de linhas (numa chamada só, um arquivo de 10 MB passava
// do limite de 1 MB do Server Action). Depois das posições, revalida em
// blocos as passagens pendentes/sem GPS dos veículos e do período do arquivo.
export function ImportarPosicoesForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [progresso, setProgresso] = useState<Progresso | null>(null);
  const [fase, setFase] = useState<Fase>("posicoes");
  const [resultado, setResultado] = useState<ImportacaoState>({});
  // retomada em andamento depois de uma resposta perdida
  const [aviso, setAviso] = useState<string | null>(null);
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
    setFase("posicoes");
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
      const faltando = cabecalhosFaltandoPosicoes(lido.meta.fields ?? []);
      if (faltando.length > 0) {
        setResultado({
          error:
            `Cabeçalho(s) não encontrado(s) no arquivo: ${faltando.join(", ")}. ` +
            `Esperado: ${COLUNAS_PLANILHA_POSICOES.map((c) => c.cabecalho).join(", ")}.`,
        });
        return;
      }
      if (lido.data.length === 0) {
        setResultado({ error: "O arquivo não tem nenhuma linha de dados." });
        return;
      }

      const linhas = lido.data.map(linhaPosicaoParaStaging);
      setProgresso({ enviadas: 0, total: linhas.length });

      // mesmo arquivo interrompido antes (aba fechada, resposta perdida)?
      let loteId: string | undefined;
      let offset = 0;
      const incompleto = await buscarLotePosicoesIncompleto(arquivo.name, linhas.length);
      if (
        incompleto &&
        window.confirm(
          (incompleto.processadas >= linhas.length
            ? `Este arquivo já teve as ${formatNumber(linhas.length)} linhas gravadas num lote iniciado em ` +
              `${new Date(incompleto.criadoEm).toLocaleString("pt-BR")}; se a revalidação das passagens não terminou, ` +
              "dá para rodar só ela.\n\nOK = só revalidar as passagens desse lote\n"
            : `Este arquivo já tem uma importação interrompida em ${formatNumber(incompleto.processadas)} de ` +
              `${formatNumber(linhas.length)} linhas (iniciada em ${new Date(incompleto.criadoEm).toLocaleString("pt-BR")}).\n\n` +
              "OK = continuar de onde parou\n") + "Cancelar = começar um lote novo",
        )
      ) {
        loteId = incompleto.loteId;
        offset = incompleto.processadas;
      } else {
        const inicio = await iniciarImportacaoPosicoes(arquivo.name);
        if (!inicio.loteId) {
          setResultado({ error: inicio.error ?? "Não foi possível criar o lote." });
          return;
        }
        loteId = inicio.loteId;
      }
      setProgresso({ enviadas: offset, total: linhas.length });

      // Resposta que não chega (ou erro) não para a importação: confere no
      // banco quantas linhas o lote já contou e continua dali. Cada linha do
      // arquivo conta uma vez em total_linhas, na ordem do arquivo.
      let falhasSeguidas = 0;
      while (offset < linhas.length) {
        const bloco = linhas.slice(offset, offset + TAMANHO_BLOCO_POSICOES);
        let motivoFalha: string | null = null;
        try {
          const res = await comTempoLimite(importarBlocoPosicoes(loteId, bloco), TEMPO_LIMITE_MS);
          if (res.error) motivoFalha = res.error;
        } catch (err) {
          motivoFalha = err instanceof Error ? err.message : String(err);
        }

        if (!motivoFalha) {
          falhasSeguidas = 0;
          offset += bloco.length;
          setProgresso({ enviadas: offset, total: linhas.length });
          continue;
        }

        falhasSeguidas += 1;
        if (falhasSeguidas > MAX_FALHAS_SEGUIDAS) {
          setResultado({
            error:
              `A importação parou em ${formatNumber(offset)} de ${formatNumber(linhas.length)} linhas ` +
              `depois de ${MAX_FALHAS_SEGUIDAS} tentativas: ${motivoFalha} ` +
              "Escolha o mesmo arquivo de novo para continuar de onde parou.",
          });
          return;
        }
        setAviso(`Resposta do servidor não chegou (${motivoFalha}). Conferindo onde parou e retomando...`);
        offset = await sincronizar(loteId);
        setAviso(null);
        setProgresso({ enviadas: offset, total: linhas.length });
      }

      // revalidação: a primeira chamada devolve o total de passagens a conferir
      setFase("revalidacao");
      setProgresso({ enviadas: 0, total: 0 });
      let apos: string | null = null;
      let feitas = 0;
      let total = 0;
      let tentativas = 0;
      for (;;) {
        // repetir um bloco da revalidação só reconfere as mesmas passagens
        let res: Awaited<ReturnType<typeof revalidarBlocoPosicoes>>;
        try {
          res = await comTempoLimite(revalidarBlocoPosicoes(loteId, apos, TAMANHO_BLOCO_REVALIDACAO), TEMPO_LIMITE_MS);
        } catch (err) {
          res = { error: err instanceof Error ? err.message : String(err) };
        }
        if (res.error) {
          tentativas += 1;
          if (tentativas > MAX_FALHAS_SEGUIDAS) {
            setResultado({
              error:
                `As posições foram gravadas, mas a revalidação das passagens parou em ${formatNumber(feitas)}: ` +
                `${res.error} Escolha o mesmo arquivo de novo e confirme "continuar" para retomar a revalidação.`,
            });
            return;
          }
          setAviso(`Resposta do servidor não chegou (${res.error}). Tentando de novo...`);
          await esperar(5000);
          setAviso(null);
          continue;
        }
        tentativas = 0;
        if (res.total != null) total = res.total;
        if (!res.processadas) break;
        feitas += res.processadas;
        apos = res.ultimoId ?? null;
        setProgresso({ enviadas: feitas, total: Math.max(total, feitas) });
      }

      setResultado(await finalizarImportacaoPosicoes(loteId));
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
          htmlFor="arquivo-gps"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Arquivo CSV
        </label>
        <input
          id="arquivo-gps"
          name="arquivo"
          type="file"
          accept=".csv,text/csv"
          required
          disabled={importando}
          className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200 dark:text-gray-300 dark:file:bg-gray-800 dark:file:text-gray-300"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Cabeçalhos esperados: placa, latitude, longitude (graus decimais),
          data (DD/MM/AAAA), horario (HH24:MI ou HH24:MI:SS). Sem limite de
          linhas. Depois de gravar as posições, as passagens pendentes ou sem
          dados de GPS desses veículos no período do arquivo são revalidadas.
          Veja o Manual.
        </p>
      </div>

      <Button type="submit" disabled={importando}>
        {importando ? "Importando..." : "Importar"}
      </Button>

      {progresso && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            {fase === "posicoes" ? "Etapa 1 de 2 — gravando posições" : "Etapa 2 de 2 — revalidando passagens"}
          </p>
          <BarraProgresso
            progresso={progresso}
            unidade={fase === "posicoes" ? "linhas processadas" : "passagens revalidadas"}
            textoInicial={fase === "posicoes" ? "Lendo o arquivo..." : "Buscando as passagens a revalidar..."}
          />
        </div>
      )}

      {aviso && <Alert variant="info">{aviso}</Alert>}

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
