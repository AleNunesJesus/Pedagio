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
    .select("id, nome, rodovia, concessionaria, km, sentido, ativo")
    .order("nome");
  return data ?? [];
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
    .select("*, praca_pedagio(nome), categoria_veiculo(codigo)")
    .order("vigencia_inicio", { ascending: false });
  return data ?? [];
}

export async function getTarifa(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("tarifa_praca").select("*").eq("id", id).single();
  return data;
}

export async function listEmbarcadores() {
  const supabase = await createClient();
  const { data } = await supabase.from("embarcador").select("*").order("nome");
  return data ?? [];
}
