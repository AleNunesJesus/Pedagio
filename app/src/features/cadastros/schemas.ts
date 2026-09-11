import { z } from "zod";

export const categoriaSchema = z.object({
  codigo: z.string().trim().min(1, "Informe o código."),
  descricao: z.string().trim().min(1, "Informe a descrição."),
});

export const veiculoSchema = z.object({
  placa: z.string().trim().min(1, "Informe a placa."),
  categoria_veiculo_id: z.string().trim().min(1, "Selecione a categoria."),
  frota: z.string().trim().optional(),
  ativo: z.coerce.boolean(),
});

const geoJsonPolygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
});

export const pracaSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome."),
  rodovia: z.string().trim().optional(),
  concessionaria: z.string().trim().optional(),
  km: z.coerce.number().optional(),
  sentido: z.string().trim().optional(),
  ativo: z.coerce.boolean(),
  poligono_geojson: z
    .string()
    .min(1, "Desenhe o polígono da praça no mapa.")
    .transform((value, ctx) => {
      try {
        const parsed = JSON.parse(value);
        return geoJsonPolygonSchema.parse(parsed);
      } catch {
        ctx.addIssue({ code: "custom", message: "Polígono inválido — desenhe novamente." });
        return z.NEVER;
      }
    }),
});

export const tarifaSchema = z
  .object({
    praca_id: z.string().trim().min(1, "Selecione a praça."),
    categoria_veiculo_id: z.string().trim().min(1, "Selecione a categoria."),
    valor: z.coerce.number().min(0, "Valor não pode ser negativo."),
    vigencia_inicio: z.string().trim().min(1, "Informe a data de início."),
    vigencia_fim: z.string().trim().optional(),
  })
  .refine(
    (data) => !data.vigencia_fim || data.vigencia_fim >= data.vigencia_inicio,
    { message: "Fim da vigência não pode ser antes do início.", path: ["vigencia_fim"] },
  );
