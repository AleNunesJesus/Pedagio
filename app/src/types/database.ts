// Escrito à mão a partir das migrations reais em supabase/migrations/
// (o MCP `generate_typescript_types` só cobre o schema `public`, mesmo com
// `pedagio` exposto na API — confirmado por probe direto ao PostgREST em
// 2026-09-10). Para regenerar/conferir, use
// `supabase gen types typescript --linked --schema pedagio` via CLI quando
// disponível, e reconcilie manualmente.
//
// Colunas `geometry` (poligono, geom) chegam do PostgREST como string WKB
// hex — não há conversão automática para GeoJSON. A view `vw_praca_pedagio_mapa`
// expõe uma coluna computada com `ST_AsGeoJSON` para o mapa (FASE 06.4).

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
          quantidade_eixos: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          codigo: string;
          descricao: string;
          quantidade_eixos: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          codigo?: string;
          descricao?: string;
          quantidade_eixos?: number;
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
          tipo: string;
          categoria_veiculo_id: string;
          categoria_fallback_id: string | null;
          frota: string | null;
          ativo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          placa: string;
          tipo?: string;
          categoria_veiculo_id: string;
          categoria_fallback_id?: string | null;
          frota?: string | null;
          ativo?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          placa?: string;
          tipo?: string;
          categoria_veiculo_id?: string;
          categoria_fallback_id?: string | null;
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
          {
            foreignKeyName: "veiculo_categoria_fallback_id_fkey";
            columns: ["categoria_fallback_id"];
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
          numero_fatura: string | null;
          veiculo_id: string | null;
          placa_informada: string;
          tipo_veiculo_informado: string | null;
          praca_id: string | null;
          praca_informada: string;
          sentido_informado: string | null;
          tipo_uso: string;
          condicao: string;
          data_hora: string;
          valor_cobrado: number;
          viagem_informada: string | null;
          viagem_id: string | null;
          embarcador_informada: string | null;
          embarcador_id: string | null;
          lote_importacao_id: string;
          status_validacao: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          numero_fatura?: string | null;
          veiculo_id?: string | null;
          placa_informada: string;
          tipo_veiculo_informado?: string | null;
          praca_id?: string | null;
          praca_informada: string;
          sentido_informado?: string | null;
          tipo_uso: string;
          condicao: string;
          data_hora: string;
          valor_cobrado: number;
          viagem_informada?: string | null;
          viagem_id?: string | null;
          embarcador_informada?: string | null;
          embarcador_id?: string | null;
          lote_importacao_id: string;
          status_validacao?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          numero_fatura?: string | null;
          veiculo_id?: string | null;
          placa_informada?: string;
          tipo_veiculo_informado?: string | null;
          praca_id?: string | null;
          praca_informada?: string;
          sentido_informado?: string | null;
          tipo_uso?: string;
          condicao?: string;
          data_hora?: string;
          valor_cobrado?: number;
          viagem_informada?: string | null;
          viagem_id?: string | null;
          embarcador_informada?: string | null;
          embarcador_id?: string | null;
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
          {
            foreignKeyName: "passagem_pedagio_viagem_id_fkey";
            columns: ["viagem_id"];
            isOneToOne: false;
            referencedRelation: "viagem";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "passagem_pedagio_embarcador_id_fkey";
            columns: ["embarcador_id"];
            isOneToOne: false;
            referencedRelation: "embarcador";
            referencedColumns: ["id"];
          },
        ];
      };
      viagem: {
        Row: {
          id: string;
          numero: string;
          criado_em: string;
        };
        Insert: {
          id?: string;
          numero: string;
          criado_em?: string;
        };
        Update: {
          id?: string;
          numero?: string;
          criado_em?: string;
        };
        Relationships: [];
      };
      embarcador: {
        Row: {
          id: string;
          nome: string;
          cnpj: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          nome: string;
          cnpj?: string | null;
          criado_em?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          cnpj?: string | null;
          criado_em?: string;
        };
        Relationships: [];
      };
      viagem_transporte: {
        Row: {
          id: string;
          numero_transporte: string;
          veiculo_id: string | null;
          placa_informada: string;
          cidade_origem: string | null;
          uf_origem: string | null;
          cidade_destino: string | null;
          uf_destino: string | null;
          data_hora_saida: string;
          data_hora_chegada: string;
          carreta1: string | null;
          carreta2: string | null;
          tipo_viagem: string;
          embarcador_id: string | null;
          lote_importacao_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          numero_transporte: string;
          veiculo_id?: string | null;
          placa_informada: string;
          cidade_origem?: string | null;
          uf_origem?: string | null;
          cidade_destino?: string | null;
          uf_destino?: string | null;
          data_hora_saida: string;
          data_hora_chegada: string;
          carreta1?: string | null;
          carreta2?: string | null;
          tipo_viagem: string;
          embarcador_id?: string | null;
          lote_importacao_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          numero_transporte?: string;
          veiculo_id?: string | null;
          placa_informada?: string;
          cidade_origem?: string | null;
          uf_origem?: string | null;
          cidade_destino?: string | null;
          uf_destino?: string | null;
          data_hora_saida?: string;
          data_hora_chegada?: string;
          carreta1?: string | null;
          carreta2?: string | null;
          tipo_viagem?: string;
          embarcador_id?: string | null;
          lote_importacao_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      staging_viagem_transporte: {
        Row: {
          id: number;
          placa: string | null;
          numero_transporte: string | null;
          cidade_origem: string | null;
          uf_origem: string | null;
          cidade_destino: string | null;
          uf_destino: string | null;
          data_hora_saida_texto: string | null;
          data_hora_chegada_texto: string | null;
          carreta1: string | null;
          carreta2: string | null;
          tipo_viagem_texto: string | null;
          criado_em: string;
        };
        Insert: {
          id?: number;
          placa?: string | null;
          numero_transporte?: string | null;
          cidade_origem?: string | null;
          uf_origem?: string | null;
          cidade_destino?: string | null;
          uf_destino?: string | null;
          data_hora_saida_texto?: string | null;
          data_hora_chegada_texto?: string | null;
          carreta1?: string | null;
          carreta2?: string | null;
          tipo_viagem_texto?: string | null;
          criado_em?: string;
        };
        Update: {
          id?: number;
          placa?: string | null;
          numero_transporte?: string | null;
          cidade_origem?: string | null;
          uf_origem?: string | null;
          cidade_destino?: string | null;
          uf_destino?: string | null;
          data_hora_saida_texto?: string | null;
          data_hora_chegada_texto?: string | null;
          carreta1?: string | null;
          carreta2?: string | null;
          tipo_viagem_texto?: string | null;
          criado_em?: string;
        };
        Relationships: [];
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
          categoria_veiculo_id: string | null;
          origem_categoria: string | null;
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
          categoria_veiculo_id?: string | null;
          origem_categoria?: string | null;
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
          categoria_veiculo_id?: string | null;
          origem_categoria?: string | null;
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
      staging_posicao_veiculo: {
        Row: {
          id: number;
          placa: string | null;
          latitude_texto: string | null;
          longitude_texto: string | null;
          data_texto: string | null;
          horario_texto: string | null;
          criado_em: string;
        };
        Insert: {
          id?: number;
          placa?: string | null;
          latitude_texto?: string | null;
          longitude_texto?: string | null;
          data_texto?: string | null;
          horario_texto?: string | null;
          criado_em?: string;
        };
        Update: {
          id?: number;
          placa?: string | null;
          latitude_texto?: string | null;
          longitude_texto?: string | null;
          data_texto?: string | null;
          horario_texto?: string | null;
          criado_em?: string;
        };
        Relationships: [];
      };
      usuario_perfil: {
        Row: {
          user_id: string;
          papel: string;
          criado_em: string;
          atualizado_em: string;
        };
        Insert: {
          user_id: string;
          papel: string;
          criado_em?: string;
          atualizado_em?: string;
        };
        Update: {
          user_id?: string;
          papel?: string;
          criado_em?: string;
          atualizado_em?: string;
        };
        Relationships: [];
      };
      staging_passagem_pedagio: {
        Row: {
          id: number;
          numero_fatura: string | null;
          data_texto: string | null;
          horario_texto: string | null;
          placa: string | null;
          tipo_veiculo: string | null;
          praca_nome: string | null;
          tipo_uso_texto: string | null;
          valor_texto: string | null;
          condicao_texto: string | null;
          viagem: string | null;
          embarcador: string | null;
          sentido: string | null;
          criado_em: string;
        };
        Insert: {
          id?: number;
          numero_fatura?: string | null;
          data_texto?: string | null;
          horario_texto?: string | null;
          placa?: string | null;
          tipo_veiculo?: string | null;
          praca_nome?: string | null;
          tipo_uso_texto?: string | null;
          valor_texto?: string | null;
          condicao_texto?: string | null;
          viagem?: string | null;
          embarcador?: string | null;
          sentido?: string | null;
          criado_em?: string;
        };
        Update: {
          id?: number;
          numero_fatura?: string | null;
          data_texto?: string | null;
          horario_texto?: string | null;
          placa?: string | null;
          tipo_veiculo?: string | null;
          praca_nome?: string | null;
          tipo_uso_texto?: string | null;
          valor_texto?: string | null;
          condicao_texto?: string | null;
          viagem?: string | null;
          embarcador?: string | null;
          sentido?: string | null;
          criado_em?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      vw_praca_pedagio_mapa: {
        Row: {
          id: string | null;
          nome: string | null;
          rodovia: string | null;
          concessionaria: string | null;
          km: number | null;
          poligono_geojson: Json | null;
          sentido: string | null;
          ativo: boolean | null;
          created_at: string | null;
        };
        Relationships: [];
      };
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
          numero_fatura: string | null;
          tipo_veiculo_informado: string | null;
          sentido_informado: string | null;
          tipo_uso: string | null;
          condicao: string | null;
          viagem: string | null;
          embarcador: string | null;
          viagem_id: string | null;
          embarcador_id: string | null;
          posicao_veiculo_id: number | null;
          categoria_veiculo_id: string | null;
          origem_categoria: string | null;
          categoria_codigo: string | null;
          categoria_descricao: string | null;
        };
        Relationships: [];
      };
      vw_posicao_veiculo: {
        Row: {
          id: number | null;
          veiculo_id: string | null;
          placa: string | null;
          latitude: number | null;
          longitude: number | null;
          data_hora: string | null;
          fonte: string | null;
          lote_importacao_id: string | null;
        };
        Relationships: [];
      };
      vw_viagem_transporte_detalhado: {
        Row: {
          id: string | null;
          numero_transporte: string | null;
          veiculo_id: string | null;
          placa_informada: string | null;
          cidade_origem: string | null;
          uf_origem: string | null;
          cidade_destino: string | null;
          uf_destino: string | null;
          data_hora_saida: string | null;
          data_hora_chegada: string | null;
          carreta1: string | null;
          carreta2: string | null;
          tipo_viagem: string | null;
          embarcador_id: string | null;
          embarcador_nome: string | null;
          lote_importacao_id: string | null;
          created_at: string | null;
          valor_pedagios: number | null;
          valor_tarifa_esperada: number | null;
          divergencia_valor: number | null;
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
      vw_valores_por_tipo_uso_mensal: {
        Row: {
          mes: string | null;
          tipo_uso: string | null;
          qtd_passagens: number | null;
          total_cobrado: number | null;
        };
        Relationships: [];
      };
      vw_valores_por_vinculo_viagem_mensal: {
        Row: {
          mes: string | null;
          vinculo: string | null;
          qtd_passagens: number | null;
          total_cobrado: number | null;
        };
        Relationships: [];
      };
      vw_fatura_resumo: {
        Row: {
          numero_fatura: string | null;
          qtd_total: number | null;
          qtd_passagem: number | null;
          qtd_contrato: number | null;
          valor_total: number | null;
          valor_passagem: number | null;
          valor_contrato: number | null;
          periodo_inicio: string | null;
          periodo_fim: string | null;
          qtd_ok: number | null;
          qtd_pendente: number | null;
          qtd_sem_dados_gps: number | null;
          qtd_sem_cadastro: number | null;
          qtd_valor_divergente: number | null;
          qtd_fora_poligono: number | null;
          qtd_local_e_valor_divergentes: number | null;
          qtd_nao_aplicavel: number | null;
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
      vw_divergencia_por_status: {
        Row: {
          status_validacao: string | null;
          qtd_passagens: number | null;
          total_cobrado: number | null;
          total_esperado: number | null;
          divergencia_valor: number | null;
        };
        Relationships: [];
      };
      vw_divergencia_por_praca: {
        Row: {
          praca_id: string | null;
          praca_nome: string | null;
          rodovia: string | null;
          qtd_passagens: number | null;
          total_cobrado: number | null;
          total_esperado: number | null;
          divergencia_valor: number | null;
        };
        Relationships: [];
      };
      vw_divergencia_por_veiculo: {
        Row: {
          veiculo_id: string | null;
          placa: string | null;
          qtd_passagens: number | null;
          total_cobrado: number | null;
          total_esperado: number | null;
          divergencia_valor: number | null;
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
      criar_praca: {
        Args: {
          p_nome: string;
          p_poligono_geojson: Json;
          p_rodovia?: string | null;
          p_concessionaria?: string | null;
          p_km?: number | null;
          p_sentido?: string | null;
          p_ativo?: boolean;
        };
        Returns: Database["pedagio"]["Tables"]["praca_pedagio"]["Row"];
      };
      atualizar_praca: {
        Args: {
          p_id: string;
          p_nome: string;
          p_poligono_geojson: Json;
          p_rodovia?: string | null;
          p_concessionaria?: string | null;
          p_km?: number | null;
          p_sentido?: string | null;
          p_ativo?: boolean;
        };
        Returns: Database["pedagio"]["Tables"]["praca_pedagio"]["Row"];
      };
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
      parse_data_hora_planilha: {
        Args: { p_data: string; p_horario: string };
        Returns: string | null;
      };
      normalizar_tipo_uso: {
        Args: { p_texto: string };
        Returns: string | null;
      };
      normalizar_condicao: {
        Args: { p_texto: string };
        Returns: string | null;
      };
      janela_tolerancia_validacao: {
        Args: Record<string, never>;
        Returns: string;
      };
      eh_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      usuario_autorizado: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      meu_papel: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      listar_usuarios: {
        Args: Record<string, never>;
        Returns: { user_id: string; email: string | null; papel: string | null }[];
      };
      definir_papel: {
        Args: { p_user_id: string; p_papel: string };
        Returns: Database["pedagio"]["Tables"]["usuario_perfil"]["Row"];
      };
      remover_papel: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      parse_coordenada: {
        Args: { p_texto: string };
        Returns: number | null;
      };
      processar_staging_posicoes: {
        Args: { p_arquivo_nome?: string | null; p_usuario?: string | null };
        Returns: Database["pedagio"]["Tables"]["lote_importacao"]["Row"];
      };
      parse_data_hora_combinada: {
        Args: { p_texto: string };
        Returns: string | null;
      };
      normalizar_tipo_viagem: {
        Args: { p_texto: string };
        Returns: string | null;
      };
      processar_staging_viagens_transporte: {
        Args: { p_arquivo_nome?: string | null; p_usuario?: string | null };
        Returns: Database["pedagio"]["Tables"]["lote_importacao"]["Row"];
      };
      excluir_passagens: {
        Args: { p_ids: string[] };
        Returns: undefined;
      };
      excluir_posicoes: {
        Args: { p_ids: number[] };
        Returns: undefined;
      };
      excluir_viagens_transporte: {
        Args: { p_ids: string[] };
        Returns: undefined;
      };
      excluir_tarifas: {
        Args: { p_ids: string[] };
        Returns: undefined;
      };
      excluir_lote_importacao: {
        Args: { p_lote_id: string };
        Returns: undefined;
      };
      excluir_veiculos: {
        Args: { p_ids: string[] };
        Returns: undefined;
      };
      excluir_categorias: {
        Args: { p_ids: string[] };
        Returns: undefined;
      };
      excluir_pracas: {
        Args: { p_ids: string[] };
        Returns: undefined;
      };
      excluir_embarcadores: {
        Args: { p_ids: string[] };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
