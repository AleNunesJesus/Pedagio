// Escrito à mão a partir das migrations reais em supabase/migrations/
// (o MCP `generate_typescript_types` só cobre o schema `public`, mesmo com
// `pedagio` exposto na API — confirmado por probe direto ao PostgREST em
// 2026-09-10). Para regenerar/conferir, use
// `supabase gen types typescript --linked --schema pedagio` via CLI quando
// disponível, e reconcilie manualmente.
//
// Colunas `geometry` (poligono, geom) chegam do PostgREST como string WKB
// hex — não há conversão automática para GeoJSON. A FASE 06.4 (mapa de
// praças) precisa decidir como lidar com isso (provavelmente expor uma
// coluna/view computada com `ST_AsGeoJSON`).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  pedagio: {
    Tables: {
      categoria_veiculo: {
        Row: {
          id: string;
          codigo: string;
          descricao: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          codigo: string;
          descricao: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          codigo?: string;
          descricao?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      praca_pedagio: {
        Row: {
          id: string;
          nome: string;
          rodovia: string | null;
          concessionaria: string | null;
          km: number | null;
          poligono: string;
          sentido: string | null;
          ativo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          rodovia?: string | null;
          concessionaria?: string | null;
          km?: number | null;
          poligono: string;
          sentido?: string | null;
          ativo?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          rodovia?: string | null;
          concessionaria?: string | null;
          km?: number | null;
          poligono?: string;
          sentido?: string | null;
          ativo?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      tarifa_praca: {
        Row: {
          id: string;
          praca_id: string;
          categoria_veiculo_id: string;
          valor: number;
          vigencia_inicio: string;
          vigencia_fim: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          praca_id: string;
          categoria_veiculo_id: string;
          valor: number;
          vigencia_inicio: string;
          vigencia_fim?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          praca_id?: string;
          categoria_veiculo_id?: string;
          valor?: number;
          vigencia_inicio?: string;
          vigencia_fim?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tarifa_praca_praca_id_fkey";
            columns: ["praca_id"];
            isOneToOne: false;
            referencedRelation: "praca_pedagio";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tarifa_praca_categoria_veiculo_id_fkey";
            columns: ["categoria_veiculo_id"];
            isOneToOne: false;
            referencedRelation: "categoria_veiculo";
            referencedColumns: ["id"];
          },
        ];
      };
      veiculo: {
        Row: {
          id: string;
          placa: string;
          categoria_veiculo_id: string;
          frota: string | null;
          ativo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          placa: string;
          categoria_veiculo_id: string;
          frota?: string | null;
          ativo?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          placa?: string;
          categoria_veiculo_id?: string;
          frota?: string | null;
          ativo?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "veiculo_categoria_veiculo_id_fkey";
            columns: ["categoria_veiculo_id"];
            isOneToOne: false;
            referencedRelation: "categoria_veiculo";
            referencedColumns: ["id"];
          },
        ];
      };
      lote_importacao: {
        Row: {
          id: string;
          tipo: string;
          arquivo_nome: string | null;
          usuario: string | null;
          total_linhas: number | null;
          total_erros: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tipo: string;
          arquivo_nome?: string | null;
          usuario?: string | null;
          total_linhas?: number | null;
          total_erros?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tipo?: string;
          arquivo_nome?: string | null;
          usuario?: string | null;
          total_linhas?: number | null;
          total_erros?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      posicao_veiculo: {
        Row: {
          id: number;
          veiculo_id: string;
          geom: string;
          data_hora: string;
          fonte: string;
          lote_importacao_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          veiculo_id: string;
          geom: string;
          data_hora: string;
          fonte: string;
          lote_importacao_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          veiculo_id?: string;
          geom?: string;
          data_hora?: string;
          fonte?: string;
          lote_importacao_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "posicao_veiculo_veiculo_id_fkey";
            columns: ["veiculo_id"];
            isOneToOne: false;
            referencedRelation: "veiculo";
            referencedColumns: ["id"];
          },
        ];
      };
      passagem_pedagio: {
        Row: {
          id: string;
          id_externo: string | null;
          veiculo_id: string | null;
          placa_informada: string;
          praca_id: string | null;
          praca_informada: string;
          data_hora: string;
          valor_cobrado: number;
          documento_vinculado: string | null;
          lote_importacao_id: string;
          status_validacao: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          id_externo?: string | null;
          veiculo_id?: string | null;
          placa_informada: string;
          praca_id?: string | null;
          praca_informada: string;
          data_hora: string;
          valor_cobrado: number;
          documento_vinculado?: string | null;
          lote_importacao_id: string;
          status_validacao?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          id_externo?: string | null;
          veiculo_id?: string | null;
          placa_informada?: string;
          praca_id?: string | null;
          praca_informada?: string;
          data_hora?: string;
          valor_cobrado?: number;
          documento_vinculado?: string | null;
          lote_importacao_id?: string;
          status_validacao?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "passagem_pedagio_veiculo_id_fkey";
            columns: ["veiculo_id"];
            isOneToOne: false;
            referencedRelation: "veiculo";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "passagem_pedagio_praca_id_fkey";
            columns: ["praca_id"];
            isOneToOne: false;
            referencedRelation: "praca_pedagio";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "passagem_pedagio_lote_importacao_id_fkey";
            columns: ["lote_importacao_id"];
            isOneToOne: false;
            referencedRelation: "lote_importacao";
            referencedColumns: ["id"];
          },
        ];
      };
      validacao_passagem: {
        Row: {
          id: string;
          passagem_id: string;
          posicao_veiculo_id: number | null;
          dentro_poligono: boolean | null;
          distancia_metros: number | null;
          diferenca_segundos: number | null;
          valor_esperado: number | null;
          divergencia_valor: number | null;
          resultado: string;
          validado_em: string;
        };
        Insert: {
          id?: string;
          passagem_id: string;
          posicao_veiculo_id?: number | null;
          dentro_poligono?: boolean | null;
          distancia_metros?: number | null;
          diferenca_segundos?: number | null;
          valor_esperado?: number | null;
          divergencia_valor?: number | null;
          resultado: string;
          validado_em?: string;
        };
        Update: {
          id?: string;
          passagem_id?: string;
          posicao_veiculo_id?: number | null;
          dentro_poligono?: boolean | null;
          distancia_metros?: number | null;
          diferenca_segundos?: number | null;
          valor_esperado?: number | null;
          divergencia_valor?: number | null;
          resultado?: string;
          validado_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: "validacao_passagem_passagem_id_fkey";
            columns: ["passagem_id"];
            isOneToOne: true;
            referencedRelation: "passagem_pedagio";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "validacao_passagem_posicao_veiculo_id_fkey";
            columns: ["posicao_veiculo_id"];
            isOneToOne: false;
            referencedRelation: "posicao_veiculo";
            referencedColumns: ["id"];
          },
        ];
      };
      staging_passagem_pedagio: {
        Row: {
          id: number;
          id_externo: string | null;
          placa: string | null;
          praca_nome: string | null;
          data_hora_texto: string | null;
          valor_texto: string | null;
          documento: string | null;
          criado_em: string;
        };
        Insert: {
          id?: number;
          id_externo?: string | null;
          placa?: string | null;
          praca_nome?: string | null;
          data_hora_texto?: string | null;
          valor_texto?: string | null;
          documento?: string | null;
          criado_em?: string;
        };
        Update: {
          id?: number;
          id_externo?: string | null;
          placa?: string | null;
          praca_nome?: string | null;
          data_hora_texto?: string | null;
          valor_texto?: string | null;
          documento?: string | null;
          criado_em?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      vw_passagens_detalhado: {
        Row: {
          passagem_id: string | null;
          data_hora: string | null;
          veiculo_id: string | null;
          placa: string | null;
          praca_id: string | null;
          praca_nome: string | null;
          rodovia: string | null;
          valor_cobrado: number | null;
          valor_esperado: number | null;
          divergencia_valor: number | null;
          status_validacao: string | null;
          dentro_poligono: boolean | null;
          distancia_metros: number | null;
          diferenca_segundos: number | null;
          lote_importacao_id: string | null;
        };
        Relationships: [];
      };
      vw_financeiro_mensal: {
        Row: {
          mes: string | null;
          qtd_passagens: number | null;
          total_cobrado: number | null;
          total_esperado: number | null;
          divergencia_total: number | null;
        };
        Relationships: [];
      };
      vw_gasto_por_veiculo_mensal: {
        Row: {
          veiculo_id: string | null;
          placa: string | null;
          mes: string | null;
          qtd_passagens: number | null;
          total_cobrado: number | null;
        };
        Relationships: [];
      };
      vw_gasto_por_praca: {
        Row: {
          praca_id: string | null;
          praca_nome: string | null;
          rodovia: string | null;
          qtd_passagens: number | null;
          total_cobrado: number | null;
        };
        Relationships: [];
      };
      vw_status_resumo: {
        Row: {
          status_validacao: string | null;
          qtd: number | null;
          percentual: number | null;
        };
        Relationships: [];
      };
      vw_praca_taxa_fora_poligono: {
        Row: {
          praca_id: string | null;
          praca_nome: string | null;
          rodovia: string | null;
          qtd_fora_poligono: number | null;
          qtd_total: number | null;
          taxa_fora_poligono_pct: number | null;
        };
        Relationships: [];
      };
      vw_veiculo_taxa_divergencia: {
        Row: {
          veiculo_id: string | null;
          placa: string | null;
          qtd_divergente: number | null;
          qtd_total: number | null;
          taxa_divergencia_pct: number | null;
        };
        Relationships: [];
      };
      vw_sem_dados_gps_por_dia: {
        Row: {
          dia: string | null;
          qtd_sem_dados_gps: number | null;
        };
        Relationships: [];
      };
      vw_diferenca_tempo_media_por_praca: {
        Row: {
          praca_id: string | null;
          praca_nome: string | null;
          diferenca_media_segundos: number | null;
          qtd: number | null;
        };
        Relationships: [];
      };
      vw_volume_passagens_praca_dia: {
        Row: {
          praca_id: string | null;
          praca_nome: string | null;
          dia: string | null;
          qtd_passagens: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      validar_passagem: {
        Args: { p_passagem_id: string };
        Returns: Database["pedagio"]["Tables"]["validacao_passagem"]["Row"] | null;
      };
      processar_validacoes_pendentes: {
        Args: Record<string, never>;
        Returns: number;
      };
      processar_staging_passagens: {
        Args: { p_arquivo_nome?: string | null; p_usuario?: string | null };
        Returns: Database["pedagio"]["Tables"]["lote_importacao"]["Row"];
      };
      parse_valor_brl: {
        Args: { p_texto: string };
        Returns: number | null;
      };
      parse_data_hora_br: {
        Args: { p_texto: string };
        Returns: string | null;
      };
      janela_tolerancia_validacao: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
