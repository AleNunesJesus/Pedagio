export const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB",
  "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

// nome do estado (como o Nominatim devolve em address.state) → sigla
export const UF_POR_ESTADO: Record<string, string> = {
  "Acre": "AC", "Alagoas": "AL", "Amazonas": "AM", "Amapá": "AP", "Bahia": "BA",
  "Ceará": "CE", "Distrito Federal": "DF", "Espírito Santo": "ES", "Goiás": "GO",
  "Maranhão": "MA", "Minas Gerais": "MG", "Mato Grosso do Sul": "MS", "Mato Grosso": "MT",
  "Pará": "PA", "Paraíba": "PB", "Pernambuco": "PE", "Piauí": "PI", "Paraná": "PR",
  "Rio de Janeiro": "RJ", "Rio Grande do Norte": "RN", "Rondônia": "RO", "Roraima": "RR",
  "Rio Grande do Sul": "RS", "Santa Catarina": "SC", "Sergipe": "SE", "São Paulo": "SP",
  "Tocantins": "TO",
};
