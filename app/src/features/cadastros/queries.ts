import { createClient } from "@/lib/supabase/server";

export async function listCategorias() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categoria_veiculo")
    .select("*")
    .order("codigo");
  return data ?? [];
}

export async function getCategoria(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("categoria_veiculo").select("*").eq("id", id).single();
  return data;
}

const VEICULO_SELECT =
  "*, categoria_veiculo!veiculo_categoria_veiculo_id_fkey(codigo, descricao, quantidade_eixos), categoria_fallback:categoria_veiculo!veiculo_categoria_fallback_id_fkey(codigo, descricao)";

export async function listVeiculos() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("veiculo")
    .select(VEICULO_SELECT)
    .order("tipo")
    .order("placa");
  return data ?? [];
}

export async function getVeiculo(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("veiculo")
    .select(VEICULO_SELECT)
    .eq("id", id)
    .single();
  return data;
}

export async function listPracas() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("praca_pedagio")
    .select(
      "id, nome, rodovia, concessionaria, km, sentido, ativo, cadastro_pendente, lote_importacao(arquivo_nome, created_at)",
    )
    .order("cadastro_pendente", { ascending: false })
    .order("nome");
  return data ?? [];
}

// cadastros criados automaticamente pela importação da fatura (FASE 22)
export async function contarCadastrosPendentes() {
  const supabase = await createClient();
  const [{ count: pracas }, { count: estacionamentos }] = await Promise.all([
    supabase
      .from("praca_pedagio")
      .select("id", { count: "exact", head: true })
      .eq("cadastro_pendente", true),
    supabase
      .from("estacionamento")
      .select("id", { count: "exact", head: true })
      .eq("cadastro_pendente", true),
  ]);
  return { pracas: pracas ?? 0, estacionamentos: estacionamentos ?? 0 };
}

export async function getOrigemCadastro(loteId: string | null) {
  if (!loteId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("lote_importacao")
    .select("arquivo_nome, created_at")
    .eq("id", loteId)
    .single();
  return data;
}

export async function getPracaMapa(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vw_praca_pedagio_mapa")
    .select("*")
    .eq("id", id)
    .single();
  return data;
}

export async function listTarifas() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tarifa_praca")
    .select("*, praca_pedagio(nome)")
    .order("vigencia_inicio", { ascending: false });
  return data ?? [];
}

// FASE 24: sugestões pendentes (as decididas ficam no banco só como histórico)
export async function listSugestoesTarifa() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tarifa_eixo_sugestao")
    .select("*, praca_pedagio(nome)")
    .eq("status", "pendente")
    .order("passagens_total", { ascending: false });
  return data ?? [];
}

export async function contarSugestoesTarifaPendentes() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("tarifa_eixo_sugestao")
    .select("id", { count: "exact", head: true })
    .eq("status", "pendente");
  return count ?? 0;
}

// período padrão do "gerar sugestões": o das passagens importadas
export async function getPeriodoPassagens() {
  const supabase = await createClient();
  const [{ data: primeira }, { data: ultima }] = await Promise.all([
    supabase.from("passagem_pedagio").select("data_hora").order("data_hora").limit(1).maybeSingle(),
    supabase.from("passagem_pedagio").select("data_hora").order("data_hora", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const dia = (iso: string | undefined) =>
    iso ? new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }) : "";
  return { inicio: dia(primeira?.data_hora), fim: dia(ultima?.data_hora) };
}

export async function getTarifa(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("tarifa_praca").select("*").eq("id", id).single();
  return data;
}

export async function listEstacionamentos() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("estacionamento")
    .select("id, nome, ativo, cadastro_pendente, lote_importacao(arquivo_nome, created_at)")
    .order("cadastro_pendente", { ascending: false })
    .order("nome");
  return data ?? [];
}

export async function getEstacionamentoMapa(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vw_estacionamento_mapa")
    .select("*")
    .eq("id", id)
    .single();
  return data;
}

export async function listTarifasEstacionamento() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tarifa_estacionamento")
    .select("*, estacionamento(nome)")
    .order("vigencia_inicio", { ascending: false });
  return data ?? [];
}

export async function getTarifaEstacionamento(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("tarifa_estacionamento").select("*").eq("id", id).single();
  return data;
}

export async function listEmbarcadores() {
  const supabase = await createClient();
  const { data } = await supabase.from("embarcador").select("*").order("nome");
  return data ?? [];
}
