// Carrega o instantâneo pedagio.tarifa_eixo_antt (FASE 28) a partir do painel
// público "Tarifas Vigentes" da ANTT (Power BI publish-to-web).
//
// Uso (na pasta app/):
//   DATABASE_URL=postgres://... node scripts/carregar-tarifas-antt.mjs           -> ensaio (rollback)
//   DATABASE_URL=postgres://... node scripts/carregar-tarifas-antt.mjs --gravar  -> grava
//
// DATABASE_URL: conexão direta (pooler de sessão, usuário postgres.<ref>).
// Rodar de novo a cada reajuste; depois, gerar as sugestões outra vez na tela.
//
// O painel não é uma API oficial: se a ANTT mudar o relatório, a chave ou os
// nomes de tabela/coluna abaixo, o script para com erro (nada é gravado).

import pg from "pg";

const RESOURCE_KEY = "c545ffef-0538-465e-b599-f2b9f59368c8";
const HOST = "https://wabi-brazil-south-api.analysis.windows.net";
const RAIO_M = 3000;
// concessões encerradas que o painel ainda lista no mesmo ponto da sucessora
// (CONCEBRA → Way 153 / Way 262: a fatura de set/2026 cobra o valor da Way).
// Só desempatam praça ambígua; casada sozinha, a praça entra normalmente.
const SUBSTITUIDAS = new Set(["CONCEBRA"]);
const gravar = process.argv.includes("--gravar");

async function pbi(path, body) {
  const r = await fetch(`${HOST}/public/reports/${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", "X-PowerBI-ResourceKey": RESOURCE_KEY },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`Power BI ${path}: HTTP ${r.status}`);
  return r.json();
}

// Consulta agrupando por todas as colunas — os visuais do painel SOMAM
// categorias de mesma descrição (ex.: "categoria 21" = 6+7+8), por isso
// nada é agregado aqui.
async function consultar(modelId, entidade, colunas) {
  const Select = colunas.map((p) => ({
    Column: { Expression: { SourceRef: { Source: "t" } }, Property: p },
    Name: `t.${p}`,
  }));
  const j = await pbi("querydata?synchronous=true", {
    version: "1.0.0",
    queries: [
      {
        Query: {
          Commands: [
            {
              SemanticQueryDataShapeCommand: {
                Query: { Version: 2, From: [{ Name: "t", Entity: entidade, Type: 0 }], Select },
                Binding: {
                  Primary: { Groupings: [{ Projections: Select.map((_, i) => i) }] },
                  DataReduction: { DataVolume: 4, Primary: { Window: { Count: 30000 } } },
                  Version: 1,
                },
              },
            },
          ],
        },
        QueryId: "",
      },
    ],
    cancelQueries: [],
    modelId,
  });
  const ds = j.results?.[0]?.result?.data?.dsr?.DS?.[0];
  if (!ds) throw new Error(`consulta ${entidade}: ${JSON.stringify(j).slice(0, 500)}`);
  if (!ds.IC) throw new Error(`consulta ${entidade}: resultado incompleto (mais de 30000 linhas?)`);

  // formato DSR: S = esquema (muda no meio), R = bits "repete o valor da
  // linha anterior", Ø = bits nulos, ValueDicts = dicionário de strings
  const dicts = ds.ValueDicts ?? {};
  const linhas = [];
  let esquema = null;
  let anterior = [];
  for (const dm of ds.PH[0].DM0) {
    if (dm.S) esquema = dm.S;
    const C = dm.C ?? [];
    const linha = [];
    let ci = 0;
    for (let i = 0; i < esquema.length; i++) {
      if (dm.R && (dm.R >> i) & 1) linha.push(anterior[i]);
      else if (dm["Ø"] && (dm["Ø"] >> i) & 1) linha.push(null);
      else {
        let v = C[ci++];
        if (esquema[i].DN && typeof v === "number") v = dicts[esquema[i].DN][v];
        linha.push(v);
      }
    }
    linhas.push(Object.fromEntries(colunas.map((c, i) => [c, linha[i]])));
    anterior = linha;
  }
  return linhas;
}

const dia = (ms) => (ms == null ? null : new Date(Number(ms)).toISOString().slice(0, 10));

function moda(valores) {
  const n = new Map();
  for (const v of valores) n.set(v, (n.get(v) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? null;
}

// valor por eixo de um conjunto de linhas: caminhão (rodagem dupla, 2+ eixos)
function porEixo(linhas) {
  const cam = linhas.filter((l) => l.Rodagem === "Dupla" && l["Número de Eixos"] >= 2 && l.Valor > 0);
  if (cam.length === 0) return null;
  return {
    valor: moda(cam.map((l) => Math.round((100 * l.Valor) / l["Número de Eixos"]) / 100)),
    coleta: dia(Math.max(...cam.map((l) => Number(l["Data Coleta"]) || 0)) || null),
  };
}

const rodoviaNorm = (s) => {
  const m = String(s ?? "").toUpperCase().match(/\b(BR|SP|PR|MG|RS|SC|GO|MS|RJ|ES|BA)[\s-]?0*(\d{1,3})\b/);
  return m ? `${m[1]}${Number(m[2])}` : null;
};

async function main() {
  const meta = await pbi(`${RESOURCE_KEY}/modelsAndExploration?preferReadOnlySession=true`);
  const modelId = meta.models?.[0]?.id;
  if (!modelId) throw new Error("modelo do painel não encontrado");

  const tarifas = await consultar(modelId, "Tarifas Vigentes", [
    "Concessionária", "Praça", "Categoria", "Tipo Veículo", "Rodagem",
    "Número de Eixos", "Multiplicador", "Valor", "Data Coleta", "Ativo/Inativo",
  ]);
  const locais = await consultar(modelId, "Loc Praças", [
    "Concessionária", "Nome Praça", "Rodovia", "km", "UF", "Município", "Latitude", "Longitude",
  ]);
  console.log(`painel: ${tarifas.length} linhas de tarifa, ${locais.length} praças com local`);

  const porPraca = new Map();
  for (const t of tarifas) {
    const k = `${t["Concessionária"]}|${t["Praça"]}`;
    if (!porPraca.has(k)) porPraca.set(k, []);
    porPraca.get(k).push(t);
  }

  const antt = [];
  for (const l of locais) {
    const linhas = porPraca.get(`${l["Concessionária"]}|${l["Nome Praça"]}`) ?? [];
    const atual = porEixo(linhas.filter((t) => t["Ativo/Inativo"] === "Ativo"));
    if (!atual || l.Latitude == null || l.Longitude == null) continue;
    // anterior = linhas inativas da coleta mais recente
    const inativas = linhas.filter((t) => t["Ativo/Inativo"] === "Inativo");
    const ultimaColeta = Math.max(0, ...inativas.map((t) => Number(t["Data Coleta"]) || 0));
    const anterior = porEixo(inativas.filter((t) => Number(t["Data Coleta"]) === ultimaColeta));
    antt.push({
      concessionaria: l["Concessionária"],
      praca: l["Nome Praça"],
      rodovia: rodoviaNorm(l.Rodovia),
      lat: l.Latitude,
      lon: l.Longitude,
      valor: atual.valor,
      coleta: atual.coleta,
      valor_ant: anterior && anterior.valor !== atual.valor ? anterior.valor : null,
      coleta_ant: anterior && anterior.valor !== atual.valor ? anterior.coleta : null,
      categorias: linhas.map((t) => ({
        categoria: t.Categoria,
        tipo: t["Tipo Veículo"],
        rodagem: t.Rodagem,
        eixos: t["Número de Eixos"],
        valor: t.Valor,
        coleta: dia(t["Data Coleta"]),
        ativo: t["Ativo/Inativo"] === "Ativo",
      })),
    });
  }
  console.log(`ANTT: ${antt.length} praças com valor por eixo de caminhão`);

  const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  try {
    await db.query("begin");
    await db.query(`create temp table _antt (i int, lat float8, lon float8) on commit drop`);
    await db.query(
      `insert into _antt select * from unnest($1::int[], $2::float8[], $3::float8[])`,
      [antt.map((_, i) => i), antt.map((a) => a.lat), antt.map((a) => a.lon)],
    );
    // as duas praças ANTT mais próximas do centroide de cada praça nossa
    const { rows: pares } = await db.query(
      `select p.id, p.nome, x.i, x.d, x.ordem
       from pedagio.praca_pedagio p
       cross join lateral (
         select a.i, round(st_distance(st_centroid(p.poligono)::geography,
                  st_setsrid(st_makepoint(a.lon, a.lat), 4326)::geography))::int as d,
                row_number() over (order by st_centroid(p.poligono)::geography <-> st_setsrid(st_makepoint(a.lon, a.lat), 4326)::geography) as ordem
         from _antt a
         order by st_centroid(p.poligono)::geography <-> st_setsrid(st_makepoint(a.lon, a.lat), 4326)::geography
         limit 2
       ) x
       where p.ativo and p.poligono is not null`,
    );

    const porNossa = new Map();
    for (const r of pares) {
      if (!porNossa.has(r.id)) porNossa.set(r.id, { nome: r.nome, c: [] });
      porNossa.get(r.id).c.push(r);
    }
    const gravaveis = [];
    const fora = [];
    for (const [id, { nome, c }] of porNossa) {
      let [p1, p2] = c.sort((a, b) => a.ordem - b.ordem);
      if (!p1 || p1.d > RAIO_M) continue;
      if (p2 && p2.d <= RAIO_M && antt[p2.i].valor !== antt[p1.i].valor) {
        const sub1 = SUBSTITUIDAS.has(antt[p1.i].concessionaria);
        const sub2 = SUBSTITUIDAS.has(antt[p2.i].concessionaria);
        if (sub1 === sub2) {
          fora.push(`${nome}: ambígua (${antt[p1.i].praca} ${p1.d} m × ${antt[p2.i].praca} ${p2.d} m)`);
          continue;
        }
        if (sub1) [p1, p2] = [p2, p1];
      }
      const a = antt[p1.i];
      const nossa = rodoviaNorm(nome);
      if (nossa && a.rodovia && nossa !== a.rodovia) {
        fora.push(`${nome}: rodovia ${nossa} × ANTT ${a.rodovia} (${a.praca}, ${p1.d} m)`);
        continue;
      }
      gravaveis.push({ id, a, d: p1.d });
    }

    await db.query("delete from pedagio.tarifa_eixo_antt");
    for (const { id, a, d } of gravaveis) {
      await db.query(
        `insert into pedagio.tarifa_eixo_antt (praca_id, concessionaria, praca_antt, distancia_m, valor_eixo,
           coletado_em, valor_eixo_anterior, anterior_coletado_em, categorias)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, a.concessionaria, a.praca, d, a.valor, a.coleta, a.valor_ant, a.coleta_ant, JSON.stringify(a.categorias)],
      );
    }
    const porConc = {};
    for (const { a } of gravaveis) porConc[a.concessionaria] = (porConc[a.concessionaria] ?? 0) + 1;
    console.log(`casadas: ${gravaveis.length} praças nossas (até ${RAIO_M} m); fora por conflito: ${fora.length}`);
    console.log(`  por concessionária: ${Object.entries(porConc).sort().map(([k, n]) => `${k} ${n}`).join(", ")}`);
    for (const f of fora) console.log(`  - ${f}`);

    await db.query(gravar ? "commit" : "rollback");
    console.log(gravar ? "gravado." : "ensaio: nada gravado (use --gravar).");
  } catch (e) {
    await db.query("rollback").catch(() => {});
    throw e;
  } finally {
    await db.end();
  }
}

main().then(
  () => (process.exitCode = 0),
  (e) => {
    console.error(e);
    process.exitCode = 1;
  },
);
