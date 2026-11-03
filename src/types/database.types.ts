export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      _backup_paquico_prices_20261001: {
        Row: {
          backed_up_at: string | null
          id: string | null
          price: number | null
          sku: string | null
        }
        Insert: {
          backed_up_at?: string | null
          id?: string | null
          price?: number | null
          sku?: string | null
        }
        Update: {
          backed_up_at?: string | null
          id?: string | null
          price?: number | null
          sku?: string | null
        }
        Relationships: []
      }
      ai_credits: {
        Row: {
          balance: number
          organization_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          organization_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_credits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_log: {
        Row: {
          completion_tokens: number | null
          created_at: string
          customer_id: string | null
          error_message: string | null
          feature: string
          generated_text: string | null
          id: string
          iterations: number | null
          organization_id: string
          prompt_tokens: number | null
          question: string | null
          status: string
          tool_args: Json | null
          tool_names: string[] | null
        }
        Insert: {
          completion_tokens?: number | null
          created_at?: string
          customer_id?: string | null
          error_message?: string | null
          feature: string
          generated_text?: string | null
          id?: string
          iterations?: number | null
          organization_id: string
          prompt_tokens?: number | null
          question?: string | null
          status?: string
          tool_args?: Json | null
          tool_names?: string[] | null
        }
        Update: {
          completion_tokens?: number | null
          created_at?: string
          customer_id?: string | null
          error_message?: string | null
          feature?: string
          generated_text?: string | null
          id?: string
          iterations?: number | null
          organization_id?: string
          prompt_tokens?: number | null
          question?: string | null
          status?: string
          tool_args?: Json | null
          tool_names?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          changed_fields: string[] | null
          created_at: string | null
          id: string
          ip_address: unknown
          new_data: Json | null
          notes: string | null
          old_data: Json | null
          organization_id: string | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: string[] | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          notes?: string | null
          old_data?: Json | null
          organization_id?: string | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: string[] | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          notes?: string | null
          old_data?: Json | null
          organization_id?: string | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      biller_comprobantes: {
        Row: {
          biller_id: number | null
          created_at: string
          estado: string
          id: string
          numero: number | null
          numero_interno: string | null
          order_id: string | null
          organization_id: string
          pdf_url: string | null
          raw_response: Json | null
          serie: string | null
          tipo_comprobante: number
        }
        Insert: {
          biller_id?: number | null
          created_at?: string
          estado?: string
          id?: string
          numero?: number | null
          numero_interno?: string | null
          order_id?: string | null
          organization_id: string
          pdf_url?: string | null
          raw_response?: Json | null
          serie?: string | null
          tipo_comprobante: number
        }
        Update: {
          biller_id?: number | null
          created_at?: string
          estado?: string
          id?: string
          numero?: number | null
          numero_interno?: string | null
          order_id?: string | null
          organization_id?: string
          pdf_url?: string | null
          raw_response?: Json | null
          serie?: string | null
          tipo_comprobante?: number
        }
        Relationships: [
          {
            foreignKeyName: "biller_comprobantes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biller_comprobantes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      biller_config: {
        Row: {
          ambiente: string
          created_at: string
          id: string
          indicador_facturacion_default: number
          montos_brutos: number
          organization_id: string
          sucursal_id: number
          token: string
          updated_at: string
        }
        Insert: {
          ambiente?: string
          created_at?: string
          id?: string
          indicador_facturacion_default?: number
          montos_brutos?: number
          organization_id: string
          sucursal_id: number
          token: string
          updated_at?: string
        }
        Update: {
          ambiente?: string
          created_at?: string
          id?: string
          indicador_facturacion_default?: number
          montos_brutos?: number
          organization_id?: string
          sucursal_id?: number
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "biller_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_inventory: {
        Row: {
          avg_unit_cost: number
          branch_id: string
          cost_updated_at: string | null
          created_at: string | null
          id: string
          last_purchase_unit_cost: number | null
          low_stock_threshold: number | null
          min_stock: number | null
          product_id: string | null
          stock: number
          updated_at: string | null
          variant_id: string | null
        }
        Insert: {
          avg_unit_cost?: number
          branch_id: string
          cost_updated_at?: string | null
          created_at?: string | null
          id?: string
          last_purchase_unit_cost?: number | null
          low_stock_threshold?: number | null
          min_stock?: number | null
          product_id?: string | null
          stock?: number
          updated_at?: string | null
          variant_id?: string | null
        }
        Update: {
          avg_unit_cost?: number
          branch_id?: string
          cost_updated_at?: string | null
          created_at?: string | null
          id?: string
          last_purchase_unit_cost?: number | null
          low_stock_threshold?: number | null
          min_stock?: number | null
          product_id?: string | null
          stock?: number
          updated_at?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branch_inventory_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_inventory_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_inventory_invalid_backup: {
        Row: {
          avg_unit_cost: number | null
          branch_id: string | null
          cost_updated_at: string | null
          created_at: string | null
          id: string | null
          last_purchase_unit_cost: number | null
          low_stock_threshold: number | null
          min_stock: number | null
          product_id: string | null
          stock: number | null
          updated_at: string | null
          variant_id: string | null
        }
        Insert: {
          avg_unit_cost?: number | null
          branch_id?: string | null
          cost_updated_at?: string | null
          created_at?: string | null
          id?: string | null
          last_purchase_unit_cost?: number | null
          low_stock_threshold?: number | null
          min_stock?: number | null
          product_id?: string | null
          stock?: number | null
          updated_at?: string | null
          variant_id?: string | null
        }
        Update: {
          avg_unit_cost?: number | null
          branch_id?: string | null
          cost_updated_at?: string | null
          created_at?: string | null
          id?: string | null
          last_purchase_unit_cost?: number | null
          low_stock_threshold?: number | null
          min_stock?: number | null
          product_id?: string | null
          stock?: number | null
          updated_at?: string | null
          variant_id?: string | null
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string | null
          can_dispatch: boolean
          can_receive: boolean
          can_sell: boolean
          city: string | null
          code: string | null
          country: string | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          is_isolated_warehouse: boolean
          kind: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          postal_code: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          can_dispatch?: boolean
          can_receive?: boolean
          can_sell?: boolean
          city?: string | null
          code?: string | null
          country?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_isolated_warehouse?: boolean
          kind?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          postal_code?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          can_dispatch?: boolean
          can_receive?: boolean
          can_sell?: boolean
          city?: string | null
          code?: string | null
          country?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_isolated_warehouse?: boolean
          kind?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          postal_code?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          product_id: string
          quantity: number
          updated_at: string | null
          user_id: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          product_id: string
          quantity?: number
          updated_at?: string | null
          user_id: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          product_id?: string
          quantity?: number
          updated_at?: string | null
          user_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          branch_id: string
          closed_at: string | null
          closed_by: string | null
          closing_amount: number | null
          created_at: string | null
          difference: number | null
          expected_amount: number | null
          id: string
          notes: string | null
          opened_at: string | null
          opened_by: string | null
          opening_amount: number
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          branch_id: string
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          created_at?: string | null
          difference?: number | null
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string | null
          opened_by?: string | null
          opening_amount?: number
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          branch_id?: string
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          created_at?: string | null
          difference?: number | null
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string | null
          opened_by?: string | null
          opening_amount?: number
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          name: string
          organization_id: string
          parent_id: string | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          organization_id: string
          parent_id?: string | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          organization_id?: string
          parent_id?: string | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_categories_parent"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tag_assignments: {
        Row: {
          created_at: string | null
          customer_id: string
          id: string
          organization_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          id?: string
          organization_id: string
          tag_id: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          id?: string
          organization_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_tag_assignments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tag_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "customer_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tags: {
        Row: {
          color: string
          created_at: string | null
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          color?: string
          created_at?: string | null
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: Json | null
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean | null
          notes: string | null
          organization_id: string
          phone: string
          rut: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: Json | null
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          organization_id: string
          phone: string
          rut?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: Json | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          organization_id?: string
          phone?: string
          rut?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_summary_logs: {
        Row: {
          channel: string | null
          date_covered: string
          email: string | null
          error: string | null
          id: string
          order_count: number
          organization_id: string
          phone: string | null
          resend_id: string | null
          sent_at: string
          status: string
          total_expenses: number
          total_sales: number
          twilio_sid: string | null
        }
        Insert: {
          channel?: string | null
          date_covered: string
          email?: string | null
          error?: string | null
          id?: string
          order_count?: number
          organization_id: string
          phone?: string | null
          resend_id?: string | null
          sent_at?: string
          status?: string
          total_expenses?: number
          total_sales?: number
          twilio_sid?: string | null
        }
        Update: {
          channel?: string | null
          date_covered?: string
          email?: string | null
          error?: string | null
          id?: string
          order_count?: number
          organization_id?: string
          phone?: string | null
          resend_id?: string | null
          sent_at?: string
          status?: string
          total_expenses?: number
          total_sales?: number
          twilio_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_summary_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_expenses: {
        Row: {
          amount: number
          branch_id: string | null
          cash_session_id: string | null
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          notes: string | null
          occurred_at: string
          organization_id: string
          payment_method: string
          updated_at: string
        }
        Insert: {
          amount: number
          branch_id?: string | null
          cash_session_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          organization_id: string
          payment_method?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          branch_id?: string | null
          cash_session_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          organization_id?: string
          payment_method?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_expenses_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_expenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_ledger: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          currency_code: string
          discount_amount: number
          entry_kind: string
          event_type: string
          gross_amount: number
          id: string
          metadata: Json
          net_amount: number
          occurred_at: string
          organization_id: string
          source_id: string
          source_table: string
          status: string
          supplier_id: string | null
          tax_amount: number
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          discount_amount?: number
          entry_kind: string
          event_type: string
          gross_amount?: number
          id?: string
          metadata?: Json
          net_amount: number
          occurred_at?: string
          organization_id: string
          source_id: string
          source_table: string
          status?: string
          supplier_id?: string | null
          tax_amount?: number
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          discount_amount?: number
          entry_kind?: string
          event_type?: string
          gross_amount?: number
          id?: string
          metadata?: Json
          net_amount?: number
          occurred_at?: string
          organization_id?: string
          source_id?: string
          source_table?: string
          status?: string
          supplier_id?: string | null
          tax_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "expense_ledger_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_ledger_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_ledger_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipt_items: {
        Row: {
          created_at: string
          discount_amount: number
          goods_receipt_id: string
          id: string
          notes: string | null
          organization_id: string
          product_id: string
          purchase_order_item_id: string | null
          quantity_received: number
          tax_amount: number
          unit_cost: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          discount_amount?: number
          goods_receipt_id: string
          id?: string
          notes?: string | null
          organization_id: string
          product_id: string
          purchase_order_item_id?: string | null
          quantity_received: number
          tax_amount?: number
          unit_cost: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          discount_amount?: number
          goods_receipt_id?: string
          id?: string
          notes?: string | null
          organization_id?: string
          product_id?: string
          purchase_order_item_id?: string | null
          quantity_received?: number
          tax_amount?: number
          unit_cost?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipt_items_goods_receipt_id_fkey"
            columns: ["goods_receipt_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_purchase_order_item_id_fkey"
            columns: ["purchase_order_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipts: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          organization_id: string
          posted_at: string | null
          posted_by: string | null
          purchase_order_id: string | null
          receipt_number: number
          received_at: string
          status: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          posted_at?: string | null
          posted_by?: string | null
          purchase_order_id?: string | null
          receipt_number?: number
          received_at?: string
          status?: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          posted_at?: string | null
          posted_by?: string | null
          purchase_order_id?: string | null
          receipt_number?: number
          received_at?: string
          status?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_drift_log: {
        Row: {
          branch_id: string
          branch_inventory_id: string
          detected_at: string
          drift: number
          id: string
          last_movement_at: string | null
          last_movement_id: string | null
          organization_id: string
          product_id: string | null
          stock_current: number
          stock_expected: number
          variant_id: string | null
        }
        Insert: {
          branch_id: string
          branch_inventory_id: string
          detected_at?: string
          drift: number
          id?: string
          last_movement_at?: string | null
          last_movement_id?: string | null
          organization_id: string
          product_id?: string | null
          stock_current: number
          stock_expected: number
          variant_id?: string | null
        }
        Update: {
          branch_id?: string
          branch_inventory_id?: string
          detected_at?: string
          drift?: number
          id?: string
          last_movement_at?: string | null
          last_movement_id?: string | null
          organization_id?: string
          product_id?: string | null
          stock_current?: number
          stock_expected?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_drift_log_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_drift_log_branch_inventory_id_fkey"
            columns: ["branch_inventory_id"]
            isOneToOne: false
            referencedRelation: "branch_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_drift_log_branch_inventory_id_fkey"
            columns: ["branch_inventory_id"]
            isOneToOne: false
            referencedRelation: "branch_inventory_org_mismatches"
            referencedColumns: ["branch_inventory_id"]
          },
          {
            foreignKeyName: "inventory_drift_log_last_movement_id_fkey"
            columns: ["last_movement_id"]
            isOneToOne: false
            referencedRelation: "inventory_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_drift_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_drift_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_drift_log_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_lots: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          notes: string | null
          organization_id: string
          product_id: string | null
          quantity_damaged: number
          quantity_received: number
          quantity_remaining: number
          received_at: string
          reference_document: string | null
          status: string
          supplier_id: string | null
          unit_cost: number | null
          updated_at: string
          variant_id: string | null
          writeoff_at: string | null
          writeoff_reason: string | null
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          product_id?: string | null
          quantity_damaged?: number
          quantity_received: number
          quantity_remaining: number
          received_at?: string
          reference_document?: string | null
          status?: string
          supplier_id?: string | null
          unit_cost?: number | null
          updated_at?: string
          variant_id?: string | null
          writeoff_at?: string | null
          writeoff_reason?: string | null
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          product_id?: string | null
          quantity_damaged?: number
          quantity_received?: number
          quantity_remaining?: number
          received_at?: string
          reference_document?: string | null
          status?: string
          supplier_id?: string | null
          unit_cost?: number | null
          updated_at?: string
          variant_id?: string | null
          writeoff_at?: string | null
          writeoff_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_lots_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_lots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_lots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_lots_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_lots_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          branch_inventory_id: string
          created_at: string | null
          created_by: string | null
          id: string
          lot_id: string | null
          movement_type: string
          new_stock: number
          notes: string | null
          previous_stock: number
          quantity: number
          reason_key: string | null
          reference_id: string | null
          reference_type: string | null
          supplier_id: string | null
        }
        Insert: {
          branch_inventory_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          lot_id?: string | null
          movement_type: string
          new_stock: number
          notes?: string | null
          previous_stock: number
          quantity: number
          reason_key?: string | null
          reference_id?: string | null
          reference_type?: string | null
          supplier_id?: string | null
        }
        Update: {
          branch_inventory_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          lot_id?: string | null
          movement_type?: string
          new_stock?: number
          notes?: string | null
          previous_stock?: number
          quantity?: number
          reason_key?: string | null
          reference_id?: string | null
          reference_type?: string | null
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_branch_inventory_id_fkey"
            columns: ["branch_inventory_id"]
            isOneToOne: false
            referencedRelation: "branch_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_branch_inventory_id_fkey"
            columns: ["branch_inventory_id"]
            isOneToOne: false
            referencedRelation: "branch_inventory_org_mismatches"
            referencedColumns: ["branch_inventory_id"]
          },
          {
            foreignKeyName: "inventory_movements_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transfers: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string | null
          from_branch_id: string
          id: string
          notes: string | null
          product_id: string | null
          quantity: number
          status: string
          to_branch_id: string
          transfer_type: string
          variant_id: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          from_branch_id: string
          id?: string
          notes?: string | null
          product_id?: string | null
          quantity: number
          status?: string
          to_branch_id: string
          transfer_type?: string
          variant_id?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          from_branch_id?: string
          id?: string
          notes?: string | null
          product_id?: string | null
          quantity?: number
          status?: string
          to_branch_id?: string
          transfer_type?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transfers_from_branch_id_fkey"
            columns: ["from_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_to_branch_id_fkey"
            columns: ["to_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      meli_config: {
        Row: {
          alert_email_enabled: boolean
          alert_email_recipient: string | null
          alert_last_sent_at: string | null
          auto_create_orders: boolean
          created_at: string
          id: string
          last_full_resync_at: string | null
          online_branch_id: string | null
          organization_id: string
          safety_reserve: number
          stock_sync_mode: string
          sync_enabled: boolean
          updated_at: string
        }
        Insert: {
          alert_email_enabled?: boolean
          alert_email_recipient?: string | null
          alert_last_sent_at?: string | null
          auto_create_orders?: boolean
          created_at?: string
          id?: string
          last_full_resync_at?: string | null
          online_branch_id?: string | null
          organization_id: string
          safety_reserve?: number
          stock_sync_mode?: string
          sync_enabled?: boolean
          updated_at?: string
        }
        Update: {
          alert_email_enabled?: boolean
          alert_email_recipient?: string | null
          alert_last_sent_at?: string | null
          auto_create_orders?: boolean
          created_at?: string
          id?: string
          last_full_resync_at?: string | null
          online_branch_id?: string | null
          organization_id?: string
          safety_reserve?: number
          stock_sync_mode?: string
          sync_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meli_config_online_branch_id_fkey"
            columns: ["online_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meli_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meli_listings: {
        Row: {
          available_quantity: number | null
          created_at: string
          id: string
          last_seen_at: string
          last_seen_run_id: string | null
          listing_status: string
          meli_item_id: string
          meli_variation_id: string
          missing_since: string | null
          organization_id: string
          permalink: string | null
          search_text: string | null
          sku: string | null
          sku_norm: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          variation_label: string | null
        }
        Insert: {
          available_quantity?: number | null
          created_at?: string
          id?: string
          last_seen_at?: string
          last_seen_run_id?: string | null
          listing_status: string
          meli_item_id: string
          meli_variation_id?: string
          missing_since?: string | null
          organization_id: string
          permalink?: string | null
          search_text?: string | null
          sku?: string | null
          sku_norm?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          variation_label?: string | null
        }
        Update: {
          available_quantity?: number | null
          created_at?: string
          id?: string
          last_seen_at?: string
          last_seen_run_id?: string | null
          listing_status?: string
          meli_item_id?: string
          meli_variation_id?: string
          missing_since?: string | null
          organization_id?: string
          permalink?: string | null
          search_text?: string | null
          sku?: string | null
          sku_norm?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          variation_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meli_listings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meli_listings_queue: {
        Row: {
          attempts: number
          claim_token: string | null
          created_at: string
          dispatched_at: string | null
          id: string
          last_error: string | null
          locked_until: string | null
          meli_item_id: string
          next_attempt_at: string
          organization_id: string
          processed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          claim_token?: string | null
          created_at?: string
          dispatched_at?: string | null
          id?: string
          last_error?: string | null
          locked_until?: string | null
          meli_item_id: string
          next_attempt_at?: string
          organization_id: string
          processed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          claim_token?: string | null
          created_at?: string
          dispatched_at?: string | null
          id?: string
          last_error?: string | null
          locked_until?: string | null
          meli_item_id?: string
          next_attempt_at?: string
          organization_id?: string
          processed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meli_listings_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meli_listings_refresh_state: {
        Row: {
          collected_count: number
          cursor_offset: number
          dispatched_at: string | null
          expected_total: number | null
          last_completed_at: string | null
          last_error: string | null
          last_error_at: string | null
          last_manual_at: string | null
          last_progress_at: string | null
          last_started_at: string | null
          lease_token: string | null
          lease_until: string | null
          meli_user_id: number | null
          organization_id: string
          requested_at: string | null
          requested_by: string | null
          run_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          collected_count?: number
          cursor_offset?: number
          dispatched_at?: string | null
          expected_total?: number | null
          last_completed_at?: string | null
          last_error?: string | null
          last_error_at?: string | null
          last_manual_at?: string | null
          last_progress_at?: string | null
          last_started_at?: string | null
          lease_token?: string | null
          lease_until?: string | null
          meli_user_id?: number | null
          organization_id: string
          requested_at?: string | null
          requested_by?: string | null
          run_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          collected_count?: number
          cursor_offset?: number
          dispatched_at?: string | null
          expected_total?: number | null
          last_completed_at?: string | null
          last_error?: string | null
          last_error_at?: string | null
          last_manual_at?: string | null
          last_progress_at?: string | null
          last_started_at?: string | null
          lease_token?: string | null
          lease_until?: string | null
          meli_user_id?: number | null
          organization_id?: string
          requested_at?: string | null
          requested_by?: string | null
          run_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meli_listings_refresh_state_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meli_product_mappings: {
        Row: {
          created_at: string
          first_push_confirmed_at: string | null
          first_push_preview: Json | null
          id: string
          last_pushed_at: string | null
          last_pushed_quantity: number | null
          last_reconciled_at: string | null
          last_sync_error: string | null
          last_synced_at: string | null
          match_source: string
          meli_item_id: string
          meli_variation_id: string | null
          organization_id: string
          product_id: string | null
          status: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          first_push_confirmed_at?: string | null
          first_push_preview?: Json | null
          id?: string
          last_pushed_at?: string | null
          last_pushed_quantity?: number | null
          last_reconciled_at?: string | null
          last_sync_error?: string | null
          last_synced_at?: string | null
          match_source?: string
          meli_item_id: string
          meli_variation_id?: string | null
          organization_id: string
          product_id?: string | null
          status?: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          first_push_confirmed_at?: string | null
          first_push_preview?: Json | null
          id?: string
          last_pushed_at?: string | null
          last_pushed_quantity?: number | null
          last_reconciled_at?: string | null
          last_sync_error?: string | null
          last_synced_at?: string | null
          match_source?: string
          meli_item_id?: string
          meli_variation_id?: string | null
          organization_id?: string
          product_id?: string | null
          status?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meli_product_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meli_product_mappings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meli_product_mappings_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      meli_sync_logs: {
        Row: {
          created_at: string
          detail: Json | null
          direction: string
          event: string
          id: string
          mapping_id: string | null
          meli_order_id: string | null
          order_id: string | null
          organization_id: string
          quantity: number | null
          status: string | null
        }
        Insert: {
          created_at?: string
          detail?: Json | null
          direction: string
          event: string
          id?: string
          mapping_id?: string | null
          meli_order_id?: string | null
          order_id?: string | null
          organization_id: string
          quantity?: number | null
          status?: string | null
        }
        Update: {
          created_at?: string
          detail?: Json | null
          direction?: string
          event?: string
          id?: string
          mapping_id?: string | null
          meli_order_id?: string | null
          order_id?: string | null
          organization_id?: string
          quantity?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meli_sync_logs_mapping_id_fkey"
            columns: ["mapping_id"]
            isOneToOne: false
            referencedRelation: "meli_product_mappings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meli_sync_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meli_sync_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meli_sync_queue: {
        Row: {
          attempts: number
          claim_token: string | null
          created_at: string
          direction: string
          dispatched_at: string | null
          force: boolean
          id: string
          last_attempt_at: string | null
          last_error: string | null
          locked_until: string | null
          mapping_id: string
          next_attempt_at: string
          organization_id: string
          payload: Json
          processed_at: string | null
          pushed_quantity: number | null
          reason: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          claim_token?: string | null
          created_at?: string
          direction?: string
          dispatched_at?: string | null
          force?: boolean
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          locked_until?: string | null
          mapping_id: string
          next_attempt_at?: string
          organization_id: string
          payload?: Json
          processed_at?: string | null
          pushed_quantity?: number | null
          reason?: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          claim_token?: string | null
          created_at?: string
          direction?: string
          dispatched_at?: string | null
          force?: boolean
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          locked_until?: string | null
          mapping_id?: string
          next_attempt_at?: string
          organization_id?: string
          payload?: Json
          processed_at?: string | null
          pushed_quantity?: number | null
          reason?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meli_sync_queue_mapping_id_fkey"
            columns: ["mapping_id"]
            isOneToOne: false
            referencedRelation: "meli_product_mappings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meli_sync_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meli_webhook_queue: {
        Row: {
          attempts: number
          claim_token: string | null
          created_at: string
          dispatched_at: string | null
          hold_reason: string | null
          id: string
          last_attempt_at: string | null
          last_error: string | null
          locked_until: string | null
          meli_user_id: number
          next_attempt_at: string
          organization_id: string
          processed_at: string | null
          resource: string
          status: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          claim_token?: string | null
          created_at?: string
          dispatched_at?: string | null
          hold_reason?: string | null
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          locked_until?: string | null
          meli_user_id: number
          next_attempt_at?: string
          organization_id: string
          processed_at?: string | null
          resource: string
          status?: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          claim_token?: string | null
          created_at?: string
          dispatched_at?: string | null
          hold_reason?: string | null
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          locked_until?: string | null
          meli_user_id?: number
          next_attempt_at?: string
          organization_id?: string
          processed_at?: string | null
          resource?: string
          status?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meli_webhook_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_config: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      notification_queue: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          metadata: Json | null
          organization_id: string
          payload: Json
          processed_at: string | null
          status: string
          type: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          metadata?: Json | null
          organization_id: string
          payload: Json
          processed_at?: string | null
          status?: string
          type: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          metadata?: Json | null
          organization_id?: string
          payload?: Json
          processed_at?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          base_unit_price: number
          cost_at_sale: number | null
          cost_source: string | null
          created_at: string | null
          discount_amount: number
          discount_metadata: Json | null
          id: string
          margin_at_sale: number | null
          margin_percentage_at_sale: number | null
          order_discount_allocated: number
          order_id: string
          price: number
          product_id: string
          quantity: number
          returned_quantity: number
          tax_amount: number | null
          tax_base_amount: number | null
          tax_fiscal_codes: Json | null
          tax_net_amount: number | null
          tax_rate_id: string | null
          tax_rate_name: string | null
          tax_rate_percent: number | null
          variant_id: string | null
        }
        Insert: {
          base_unit_price: number
          cost_at_sale?: number | null
          cost_source?: string | null
          created_at?: string | null
          discount_amount?: number
          discount_metadata?: Json | null
          id?: string
          margin_at_sale?: number | null
          margin_percentage_at_sale?: number | null
          order_discount_allocated?: number
          order_id: string
          price: number
          product_id: string
          quantity: number
          returned_quantity?: number
          tax_amount?: number | null
          tax_base_amount?: number | null
          tax_fiscal_codes?: Json | null
          tax_net_amount?: number | null
          tax_rate_id?: string | null
          tax_rate_name?: string | null
          tax_rate_percent?: number | null
          variant_id?: string | null
        }
        Update: {
          base_unit_price?: number
          cost_at_sale?: number | null
          cost_source?: string | null
          created_at?: string | null
          discount_amount?: number
          discount_metadata?: Json | null
          id?: string
          margin_at_sale?: number | null
          margin_percentage_at_sale?: number | null
          order_discount_allocated?: number
          order_id?: string
          price?: number
          product_id?: string
          quantity?: number
          returned_quantity?: number
          tax_amount?: number | null
          tax_base_amount?: number | null
          tax_fiscal_codes?: Json | null
          tax_net_amount?: number | null
          tax_rate_id?: string | null
          tax_rate_name?: string | null
          tax_rate_percent?: number | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_manual_items: {
        Row: {
          created_at: string | null
          description: string
          id: string
          order_discount_allocated: number
          order_id: string
          organization_id: string
          price: number
          quantity: number
          tax_amount: number | null
          tax_base_amount: number | null
          tax_fiscal_codes: Json | null
          tax_net_amount: number | null
          tax_rate_id: string | null
          tax_rate_name: string | null
          tax_rate_percent: number | null
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          order_discount_allocated?: number
          order_id: string
          organization_id: string
          price?: number
          quantity?: number
          tax_amount?: number | null
          tax_base_amount?: number | null
          tax_fiscal_codes?: Json | null
          tax_net_amount?: number | null
          tax_rate_id?: string | null
          tax_rate_name?: string | null
          tax_rate_percent?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          order_discount_allocated?: number
          order_id?: string
          organization_id?: string
          price?: number
          quantity?: number
          tax_amount?: number | null
          tax_base_amount?: number | null
          tax_fiscal_codes?: Json | null
          tax_net_amount?: number | null
          tax_rate_id?: string | null
          tax_rate_name?: string | null
          tax_rate_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_manual_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_manual_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_manual_items_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      order_payments: {
        Row: {
          amount: number
          carat_access_token: string | null
          carat_authorized: boolean | null
          carat_payment_id: string | null
          carat_status: string | null
          cash_session_id: string | null
          created_at: string | null
          id: string
          mp_payment_id: string | null
          mp_status: string | null
          notes: string | null
          order_id: string
          payment_method: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          carat_access_token?: string | null
          carat_authorized?: boolean | null
          carat_payment_id?: string | null
          carat_status?: string | null
          cash_session_id?: string | null
          created_at?: string | null
          id?: string
          mp_payment_id?: string | null
          mp_status?: string | null
          notes?: string | null
          order_id: string
          payment_method: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          carat_access_token?: string | null
          carat_authorized?: boolean | null
          carat_payment_id?: string | null
          carat_status?: string | null
          cash_session_id?: string | null
          created_at?: string | null
          id?: string
          mp_payment_id?: string | null
          mp_status?: string | null
          notes?: string | null
          order_id?: string
          payment_method?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_payments_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_return_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          order_item_id: string | null
          order_return_id: string
          organization_id: string
          product_id: string
          quantity: number
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: number
          order_item_id?: string | null
          order_return_id: string
          organization_id: string
          product_id: string
          quantity: number
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          order_item_id?: string | null
          order_return_id?: string
          organization_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_return_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_return_items_order_return_id_fkey"
            columns: ["order_return_id"]
            isOneToOne: false
            referencedRelation: "order_returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_return_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_return_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_returns: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          order_id: string
          organization_id: string
          posted_at: string | null
          posted_by: string | null
          reason: string
          refund_amount: number
          refund_method: string | null
          return_type: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_id: string
          organization_id: string
          posted_at?: string | null
          posted_by?: string | null
          reason: string
          refund_amount?: number
          refund_method?: string | null
          return_type?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          organization_id?: string
          posted_at?: string | null
          posted_by?: string | null
          reason?: string
          refund_amount?: number
          refund_method?: string | null
          return_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_returns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          apply_tax: boolean
          branch_id: string | null
          client_request_hash: string | null
          client_request_id: string | null
          created_at: string | null
          customer_id: string | null
          customer_note: string | null
          discount_metadata: Json | null
          discount_total: number
          id: string
          order_number: number | null
          organization_id: string
          payment_method: string | null
          prices_include_tax: boolean | null
          shipping_address: Json
          source: string
          status: Database["public"]["Enums"]["order_status"] | null
          subtotal_before_discount: number
          tax_total: number
          total: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          apply_tax?: boolean
          branch_id?: string | null
          client_request_hash?: string | null
          client_request_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_note?: string | null
          discount_metadata?: Json | null
          discount_total?: number
          id?: string
          order_number?: number | null
          organization_id: string
          payment_method?: string | null
          prices_include_tax?: boolean | null
          shipping_address: Json
          source?: string
          status?: Database["public"]["Enums"]["order_status"] | null
          subtotal_before_discount?: number
          tax_total?: number
          total: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          apply_tax?: boolean
          branch_id?: string | null
          client_request_hash?: string | null
          client_request_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_note?: string | null
          discount_metadata?: Json | null
          discount_total?: number
          id?: string
          order_number?: number | null
          organization_id?: string
          payment_method?: string | null
          prices_include_tax?: boolean | null
          shipping_address?: Json
          source?: string
          status?: Database["public"]["Enums"]["order_status"] | null
          subtotal_before_discount?: number
          tax_total?: number
          total?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_meli_oauth: {
        Row: {
          access_token: string
          connected_at: string
          created_at: string | null
          disconnect_reason: string | null
          disconnected_at: string | null
          id: string
          last_refresh_error: string | null
          meli_user_id: number
          organization_id: string
          refresh_failure_count: number
          refresh_lease_token: string | null
          refresh_lease_until: string | null
          refresh_token: string
          scope: string | null
          site_id: string | null
          token_expires_at: string
          updated_at: string | null
        }
        Insert: {
          access_token: string
          connected_at?: string
          created_at?: string | null
          disconnect_reason?: string | null
          disconnected_at?: string | null
          id?: string
          last_refresh_error?: string | null
          meli_user_id: number
          organization_id: string
          refresh_failure_count?: number
          refresh_lease_token?: string | null
          refresh_lease_until?: string | null
          refresh_token: string
          scope?: string | null
          site_id?: string | null
          token_expires_at: string
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          connected_at?: string
          created_at?: string | null
          disconnect_reason?: string | null
          disconnected_at?: string | null
          id?: string
          last_refresh_error?: string | null
          meli_user_id?: number
          organization_id?: string
          refresh_failure_count?: number
          refresh_lease_token?: string | null
          refresh_lease_until?: string | null
          refresh_token?: string
          scope?: string | null
          site_id?: string | null
          token_expires_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_meli_oauth_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string | null
          id: string
          invited_by: string | null
          joined_at: string | null
          organization_id: string
          organization_role_id: string | null
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          organization_id: string
          organization_role_id?: string | null
          role?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          organization_id?: string
          organization_role_id?: string | null
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_role_id_fkey"
            columns: ["organization_role_id"]
            isOneToOne: false
            referencedRelation: "organization_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_mercadopago_oauth: {
        Row: {
          access_token: string
          connected_at: string
          created_at: string | null
          disconnected_at: string | null
          id: string
          mp_user_id: number
          organization_id: string
          public_key: string | null
          refresh_failure_count: number
          refresh_token: string
          sandbox: boolean
          scope: string | null
          token_expires_at: string
          updated_at: string | null
        }
        Insert: {
          access_token: string
          connected_at?: string
          created_at?: string | null
          disconnected_at?: string | null
          id?: string
          mp_user_id: number
          organization_id: string
          public_key?: string | null
          refresh_failure_count?: number
          refresh_token: string
          sandbox?: boolean
          scope?: string | null
          token_expires_at: string
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          connected_at?: string
          created_at?: string | null
          disconnected_at?: string | null
          id?: string
          mp_user_id?: number
          organization_id?: string
          public_key?: string | null
          refresh_failure_count?: number
          refresh_token?: string
          sandbox?: boolean
          scope?: string | null
          token_expires_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_mercadopago_oauth_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_order_counters: {
        Row: {
          last_order_number: number
          organization_id: string
          updated_at: string
        }
        Insert: {
          last_order_number?: number
          organization_id: string
          updated_at?: string
        }
        Update: {
          last_order_number?: number
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_order_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_payment_methods: {
        Row: {
          config: Json | null
          created_at: string | null
          display_order: number
          id: string
          is_active: boolean
          key: string
          name: string
          organization_id: string
          requires_cash_session: boolean
          updated_at: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          key: string
          name: string
          organization_id: string
          requires_cash_session?: boolean
          updated_at?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          organization_id?: string
          requires_cash_session?: boolean
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_payment_methods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_payments: {
        Row: {
          amount: number
          covered_from: string
          covered_to: string
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          period_months: number
          plan: string
          registered_by: string | null
        }
        Insert: {
          amount: number
          covered_from: string
          covered_to: string
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          period_months?: number
          plan?: string
          registered_by?: string | null
        }
        Update: {
          amount?: number
          covered_from?: string
          covered_to?: string
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          period_months?: number
          plan?: string
          registered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_quote_counters: {
        Row: {
          created_at: string
          last_quote_number: number
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          last_quote_number?: number
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          last_quote_number?: number
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_quote_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_role_permissions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          organization_role_id: string
          permission_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_role_id: string
          permission_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_role_id?: string
          permission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_role_permissions_organization_role_id_fkey"
            columns: ["organization_role_id"]
            isOneToOne: false
            referencedRelation: "organization_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_roles: {
        Row: {
          base_role_key: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean
          key: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          base_role_key?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          key: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          base_role_key?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          key?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_tax_settings: {
        Row: {
          created_at: string
          organization_id: string
          prices_include_tax: boolean
          tax_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          prices_include_tax?: boolean
          tax_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          prices_include_tax?: boolean
          tax_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_tax_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          accent_color: string | null
          border_radius: string | null
          button_style: string | null
          cover_image_url: string | null
          created_at: string | null
          custom_domain: string | null
          deleted_at: string | null
          font_family: string | null
          font_heading: string | null
          id: string
          logo_url: string | null
          name: string
          primary_color: string | null
          secondary_color: string | null
          settings: Json | null
          slug: string
          storefront_branch_id: string | null
          subscription_expires_at: string | null
          subscription_status: string | null
          subscription_tier: string | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          border_radius?: string | null
          button_style?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          custom_domain?: string | null
          deleted_at?: string | null
          font_family?: string | null
          font_heading?: string | null
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string | null
          secondary_color?: string | null
          settings?: Json | null
          slug: string
          storefront_branch_id?: string | null
          subscription_expires_at?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          border_radius?: string | null
          button_style?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          custom_domain?: string | null
          deleted_at?: string | null
          font_family?: string | null
          font_heading?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          secondary_color?: string | null
          settings?: Json | null
          slug?: string
          storefront_branch_id?: string | null
          subscription_expires_at?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_storefront_branch_id_fkey"
            columns: ["storefront_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          key: string
          name: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          name: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      product_barcodes: {
        Row: {
          barcode: string
          barcode_type: Database["public"]["Enums"]["barcode_type"]
          created_at: string | null
          id: string
          is_primary: boolean | null
          notes: string | null
          product_id: string | null
          updated_at: string | null
          variant_id: string | null
        }
        Insert: {
          barcode: string
          barcode_type?: Database["public"]["Enums"]["barcode_type"]
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          notes?: string | null
          product_id?: string | null
          updated_at?: string | null
          variant_id?: string | null
        }
        Update: {
          barcode?: string
          barcode_type?: Database["public"]["Enums"]["barcode_type"]
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          notes?: string | null
          product_id?: string | null
          updated_at?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_barcodes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_barcodes_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          category_id: string
          created_at: string | null
          id: string
          organization_id: string
          product_id: string
        }
        Insert: {
          category_id: string
          created_at?: string | null
          id?: string
          organization_id: string
          product_id: string
        }
        Update: {
          category_id?: string
          created_at?: string | null
          id?: string
          organization_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string | null
          display_order: number
          id: string
          image_url: string
          is_primary: boolean | null
          product_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          id?: string
          image_url: string
          is_primary?: boolean | null
          product_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number
          id?: string
          image_url?: string
          is_primary?: boolean | null
          product_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_suppliers: {
        Row: {
          created_at: string | null
          id: string
          is_primary: boolean | null
          lead_time_days: number | null
          min_order_quantity: number | null
          notes: string | null
          product_id: string
          supplier_id: string
          supplier_price: number | null
          supplier_sku: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          lead_time_days?: number | null
          min_order_quantity?: number | null
          notes?: string | null
          product_id: string
          supplier_id: string
          supplier_price?: number | null
          supplier_sku?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          lead_time_days?: number | null
          min_order_quantity?: number | null
          notes?: string | null
          product_id?: string
          supplier_id?: string
          supplier_price?: number | null
          supplier_sku?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_suppliers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          attributes: Json | null
          created_at: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          low_stock_threshold: number | null
          min_stock: number | null
          name: string | null
          price: number | null
          product_id: string
          sku: string
          stock: number
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          attributes?: Json | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          low_stock_threshold?: number | null
          min_stock?: number | null
          name?: string | null
          price?: number | null
          product_id: string
          sku: string
          stock?: number
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          attributes?: Json | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          low_stock_threshold?: number | null
          min_stock?: number | null
          name?: string | null
          price?: number | null
          product_id?: string
          sku?: string
          stock?: number
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string
          created_at: string | null
          description: string | null
          discount_expires_at: string | null
          discount_percentage: number | null
          id: string
          image_url: string | null
          images: string[] | null
          is_active: boolean | null
          low_stock_threshold: number | null
          min_stock: number | null
          name: string
          organization_id: string
          price: number
          requires_availability_check: boolean
          sku: string
          stock: number
          tax_rate_id: string | null
          unit: string | null
          updated_at: string | null
          visible_in_store: boolean
        }
        Insert: {
          category_id: string
          created_at?: string | null
          description?: string | null
          discount_expires_at?: string | null
          discount_percentage?: number | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_active?: boolean | null
          low_stock_threshold?: number | null
          min_stock?: number | null
          name: string
          organization_id: string
          price: number
          requires_availability_check?: boolean
          sku: string
          stock?: number
          tax_rate_id?: string | null
          unit?: string | null
          updated_at?: string | null
          visible_in_store?: boolean
        }
        Update: {
          category_id?: string
          created_at?: string | null
          description?: string | null
          discount_expires_at?: string | null
          discount_percentage?: number | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_active?: boolean | null
          low_stock_threshold?: number | null
          min_stock?: number | null
          name?: string
          organization_id?: string
          price?: number
          requires_availability_check?: boolean
          sku?: string
          stock?: number
          tax_rate_id?: string | null
          unit?: string | null
          updated_at?: string | null
          visible_in_store?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tax_rate_fk"
            columns: ["organization_id", "tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string
          description: string | null
          discount_amount: number
          id: string
          line_number: number
          notes: string | null
          organization_id: string
          product_id: string
          purchase_order_id: string
          quantity_ordered: number
          quantity_received: number
          tax_amount: number
          unit_cost: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_amount?: number
          id?: string
          line_number?: number
          notes?: string | null
          organization_id: string
          product_id: string
          purchase_order_id: string
          quantity_ordered: number
          quantity_received?: number
          tax_amount?: number
          unit_cost: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_amount?: number
          id?: string
          line_number?: number
          notes?: string | null
          organization_id?: string
          product_id?: string
          purchase_order_id?: string
          quantity_ordered?: number
          quantity_received?: number
          tax_amount?: number
          unit_cost?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_by: string | null
          branch_id: string
          created_at: string
          created_by: string | null
          currency_code: string
          discount_total: number
          expected_at: string | null
          id: string
          notes: string | null
          ordered_at: string
          organization_id: string
          po_number: number
          received_at: string | null
          status: string
          subtotal: number
          supplier_id: string
          tax_total: number
          total: number
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          branch_id: string
          created_at?: string
          created_by?: string | null
          currency_code?: string
          discount_total?: number
          expected_at?: string | null
          id?: string
          notes?: string | null
          ordered_at?: string
          organization_id: string
          po_number?: number
          received_at?: string | null
          status?: string
          subtotal?: number
          supplier_id: string
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          branch_id?: string
          created_at?: string
          created_by?: string | null
          currency_code?: string
          discount_total?: number
          expected_at?: string | null
          id?: string
          notes?: string | null
          ordered_at?: string
          organization_id?: string
          po_number?: number
          received_at?: string | null
          status?: string
          subtotal?: number
          supplier_id?: string
          tax_total?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          created_at: string
          description: string
          discount_amount: number
          id: string
          item_type: string
          line_total: number | null
          order_discount_allocated: number
          organization_id: string
          product_id: string | null
          quantity: number
          quote_id: string
          tax_amount: number | null
          tax_base_amount: number | null
          tax_fiscal_codes: Json | null
          tax_net_amount: number | null
          tax_rate_id: string | null
          tax_rate_name: string | null
          tax_rate_percent: number | null
          unit_price: number
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          discount_amount?: number
          id?: string
          item_type: string
          line_total?: number | null
          order_discount_allocated?: number
          organization_id: string
          product_id?: string | null
          quantity: number
          quote_id: string
          tax_amount?: number | null
          tax_base_amount?: number | null
          tax_fiscal_codes?: Json | null
          tax_net_amount?: number | null
          tax_rate_id?: string | null
          tax_rate_name?: string | null
          tax_rate_percent?: number | null
          unit_price?: number
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          discount_amount?: number
          id?: string
          item_type?: string
          line_total?: number | null
          order_discount_allocated?: number
          organization_id?: string
          product_id?: string | null
          quantity?: number
          quote_id?: string
          tax_amount?: number | null
          tax_base_amount?: number | null
          tax_fiscal_codes?: Json | null
          tax_net_amount?: number | null
          tax_rate_id?: string | null
          tax_rate_name?: string | null
          tax_rate_percent?: number | null
          unit_price?: number
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          apply_tax: boolean
          branch_id: string | null
          converted_order_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_snapshot: Json
          discount_total: number
          id: string
          notes: string | null
          order_discount_amount: number
          organization_id: string
          prices_include_tax: boolean | null
          quote_number: number
          status: Database["public"]["Enums"]["quote_status"]
          subtotal_before_discount: number
          tax_total: number
          total: number
          updated_at: string
          updated_by: string | null
          valid_until: string | null
        }
        Insert: {
          apply_tax?: boolean
          branch_id?: string | null
          converted_order_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_snapshot?: Json
          discount_total?: number
          id?: string
          notes?: string | null
          order_discount_amount?: number
          organization_id: string
          prices_include_tax?: boolean | null
          quote_number: number
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal_before_discount?: number
          tax_total?: number
          total?: number
          updated_at?: string
          updated_by?: string | null
          valid_until?: string | null
        }
        Update: {
          apply_tax?: boolean
          branch_id?: string | null
          converted_order_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_snapshot?: Json
          discount_total?: number
          id?: string
          notes?: string | null
          order_discount_amount?: number
          organization_id?: string
          prices_include_tax?: boolean | null
          quote_number?: number
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal_before_discount?: number
          tax_total?: number
          total?: number
          updated_at?: string
          updated_by?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_converted_order_id_fkey"
            columns: ["converted_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rbac_audit_log: {
        Row: {
          action: string
          changed_at: string | null
          changed_by: string
          entity_id: string | null
          entity_type: string
          id: string
          new_data: Json | null
          old_data: Json | null
        }
        Insert: {
          action: string
          changed_at?: string | null
          changed_by: string
          entity_id?: string | null
          entity_type: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
        }
        Update: {
          action?: string
          changed_at?: string | null
          changed_by?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
        }
        Relationships: []
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_system: boolean | null
          key: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          key: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          key?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      roles_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_discount_rules: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          kind: string
          max_discount_amount: number | null
          min_order_total: number | null
          name: string
          organization_id: string
          scope: string
          starts_at: string | null
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          kind: string
          max_discount_amount?: number | null
          min_order_total?: number | null
          name: string
          organization_id: string
          scope: string
          starts_at?: string | null
          updated_at?: string
          value: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          max_discount_amount?: number | null
          min_order_total?: number | null
          name?: string
          organization_id?: string
          scope?: string
          starts_at?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_discount_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stale_order_notification_logs: {
        Row: {
          id: string
          organization_id: string
          pending_allocation_count: number
          pending_payment_count: number
          sent_at: string
          stuck_processing_count: number
          twilio_sid: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          pending_allocation_count?: number
          pending_payment_count?: number
          sent_at?: string
          stuck_processing_count?: number
          twilio_sid?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          pending_allocation_count?: number
          pending_payment_count?: number
          sent_at?: string
          stuck_processing_count?: number
          twilio_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stale_order_notification_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      store_coupons: {
        Row: {
          amount: number
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          kind: string
          organization_id: string
          updated_at: string
          valid_until: string
        }
        Insert: {
          amount: number
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          organization_id: string
          updated_at?: string
          valid_until: string
        }
        Update: {
          amount?: number
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          organization_id?: string
          updated_at?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_coupons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      store_page_views: {
        Row: {
          created_at: string
          device_type: string
          id: string
          organization_id: string
          page_path: string
          referrer: string | null
          session_id: string
          slug: string
          visitor_id: string | null
        }
        Insert: {
          created_at?: string
          device_type?: string
          id?: string
          organization_id: string
          page_path: string
          referrer?: string | null
          session_id: string
          slug: string
          visitor_id?: string | null
        }
        Update: {
          created_at?: string
          device_type?: string
          id?: string
          organization_id?: string
          page_path?: string
          referrer?: string | null
          session_id?: string
          slug?: string
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_page_views_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_invoices: {
        Row: {
          approved_by: string | null
          branch_id: string | null
          created_at: string
          created_by: string | null
          currency_code: string
          discount_total: number
          due_date: string | null
          goods_receipt_id: string | null
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          organization_id: string
          outstanding_amount: number
          paid_amount: number
          purchase_order_id: string | null
          status: string
          subtotal: number
          supplier_id: string
          tax_total: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          discount_total?: number
          due_date?: string | null
          goods_receipt_id?: string | null
          id?: string
          invoice_number: string
          issue_date?: string
          notes?: string | null
          organization_id: string
          outstanding_amount?: number
          paid_amount?: number
          purchase_order_id?: string | null
          status?: string
          subtotal?: number
          supplier_id: string
          tax_total?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          discount_total?: number
          due_date?: string | null
          goods_receipt_id?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          organization_id?: string
          outstanding_amount?: number
          paid_amount?: number
          purchase_order_id?: string | null
          status?: string
          subtotal?: number
          supplier_id?: string
          tax_total?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_goods_receipt_id_fkey"
            columns: ["goods_receipt_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          branch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          organization_id: string
          payment_date: string
          payment_method: string
          reference_number: string | null
          reversed_at: string | null
          reversed_by: string | null
          status: string
          supplier_id: string
          supplier_invoice_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          payment_date?: string
          payment_method: string
          reference_number?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: string
          supplier_id: string
          supplier_invoice_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          payment_date?: string
          payment_method?: string
          reference_number?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: string
          supplier_id?: string
          supplier_invoice_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_invoice_id_fkey"
            columns: ["supplier_invoice_id"]
            isOneToOne: false
            referencedRelation: "supplier_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          city: string | null
          contact_name: string | null
          country: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          postal_code: string | null
          tax_id: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          postal_code?: string | null
          tax_id?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          postal_code?: string | null
          tax_id?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_rates: {
        Row: {
          created_at: string
          fiscal_codes: Json
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          organization_id: string
          percentage: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          fiscal_codes?: Json
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          organization_id: string
          percentage: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          fiscal_codes?: Json
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          organization_id?: string
          percentage?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_rates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          body: string | null
          created_at: string
          dedup_key: string | null
          id: string
          org_id: string
          payload: Json
          read_at: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          dedup_key?: string | null
          id?: string
          org_id: string
          payload?: Json
          read_at?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          dedup_key?: string | null
          id?: string
          org_id?: string
          payload?: Json
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          permission_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          permission_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          permission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          address: Json | null
          created_at: string | null
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: Json | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: Json | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      wholesale_catalog_products: {
        Row: {
          catalog_id: string
          created_at: string
          id: string
          organization_id: string
          product_id: string
          sort_order: number
        }
        Insert: {
          catalog_id: string
          created_at?: string
          id?: string
          organization_id: string
          product_id: string
          sort_order?: number
        }
        Update: {
          catalog_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "wholesale_catalog_products_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "wholesale_catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_catalog_products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_catalog_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      wholesale_catalogs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_public_enabled: boolean
          name: string
          notes: string | null
          organization_id: string
          public_token: string
          token_rotated_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_public_enabled?: boolean
          name: string
          notes?: string | null
          organization_id: string
          public_token?: string
          token_rotated_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_public_enabled?: boolean
          name?: string
          notes?: string | null
          organization_id?: string
          public_token?: string
          token_rotated_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wholesale_catalogs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wholesale_price_tiers: {
        Row: {
          catalog_product_id: string
          created_at: string
          id: string
          min_quantity: number
          organization_id: string
          unit_price: number
        }
        Insert: {
          catalog_product_id: string
          created_at?: string
          id?: string
          min_quantity: number
          organization_id: string
          unit_price: number
        }
        Update: {
          catalog_product_id?: string
          created_at?: string
          id?: string
          min_quantity?: number
          organization_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "wholesale_price_tiers_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "wholesale_catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_price_tiers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      branch_inventory_org_mismatches: {
        Row: {
          branch_id: string | null
          branch_inventory_id: string | null
          branch_org_id: string | null
          created_at: string | null
          product_id: string | null
          product_org_id: string | null
          stock: number | null
          updated_at: string | null
          variant_id: string | null
          variant_org_id: string | null
          variant_product_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branch_inventory_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_inventory_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branches_organization_id_fkey"
            columns: ["branch_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["variant_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["variant_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["product_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_fin_expenses_daily: {
        Row: {
          accrual_expense: number | null
          branch_id: string | null
          cash_expense: number | null
          day: string | null
          expense_amount: number | null
          organization_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_ledger_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_ledger_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_fin_margin_daily: {
        Row: {
          branch_id: string | null
          branch_missing_items: number | null
          day: string | null
          gross_margin: number | null
          inventory_cost_missing_items: number | null
          missing_items: number | null
          organization_id: string | null
          total_items: number | null
          tracked_cost: number | null
          tracked_items: number | null
          tracked_revenue: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_fin_sales_daily: {
        Row: {
          branch_id: string | null
          day: string | null
          orders_count: number | null
          organization_id: string | null
          sales_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_all_permissions: {
        Row: {
          expires_at: string | null
          permission_category: string | null
          permission_id: string | null
          permission_key: string | null
          permission_name: string | null
          source: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _apply_uy_tax_template: {
        Args: {
          p_default_code: number
          p_enable: boolean
          p_inclusive: boolean
          p_org_id: string
        }
        Returns: undefined
      }
      _resolve_document_tax_flag: {
        Args: {
          p_apply_tax: boolean
          p_is_quote: boolean
          p_org: string
          p_source: string
        }
        Returns: {
          apply_tax: boolean
          flag: boolean
        }[]
      }
      _resolve_tax_rate: {
        Args: {
          p_org_id: string
          p_product_id: string
          p_rate_id: string
          p_variant_id: string
        }
        Returns: {
          created_at: string
          fiscal_codes: Json
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          organization_id: string
          percentage: number
          sort_order: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tax_rates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _tax_cents: { Args: { p_amount: number }; Returns: number }
      _tax_discount_cents: {
        Args: {
          p_base: number
          p_kind: string
          p_quantity: number
          p_value: number
        }
        Returns: number
      }
      _tax_distribute: {
        Args: { p_ords: number[]; p_total: number; p_weights: number[] }
        Returns: number[]
      }
      _tax_line_taxes: {
        Args: {
          p_base: number[]
          p_bps: number[]
          p_mode: string
          p_on_gross: boolean
          p_ords: number[]
        }
        Returns: number[]
      }
      _tax_of: {
        Args: { p_amount: number; p_bps: number; p_on_gross: boolean }
        Returns: number
      }
      _tax_round_div: {
        Args: { p_denominator: number; p_numerator: number }
        Returns: number
      }
      ai_tool_assert_access: { Args: { p_org: string }; Returns: undefined }
      ai_tool_range: {
        Args: { p_from: string; p_to: string; p_tz: string }
        Returns: {
          range_end: string
          range_start: string
        }[]
      }
      ai_tool_sale_statuses: { Args: never; Returns: string[] }
      ai_tool_sales_by_channel_branch: {
        Args: {
          p_dimension?: string
          p_from: string
          p_organization_id: string
          p_timezone: string
          p_to: string
        }
        Returns: Json
      }
      ai_tool_sales_by_hour: {
        Args: {
          p_from: string
          p_organization_id: string
          p_timezone: string
          p_to: string
        }
        Returns: Json
      }
      ai_tool_sales_summary: {
        Args: {
          p_compare_from?: string
          p_compare_to?: string
          p_from: string
          p_organization_id: string
          p_timezone: string
          p_to: string
        }
        Returns: Json
      }
      ai_tool_sales_totals: {
        Args: { p_end: string; p_org: string; p_start: string }
        Returns: Json
      }
      ai_tool_top_products: {
        Args: {
          p_branch_id?: string
          p_from: string
          p_limit?: number
          p_metric?: string
          p_organization_id: string
          p_timezone: string
          p_to: string
        }
        Returns: Json
      }
      ai_tool_top_viewed_products: {
        Args: {
          p_from: string
          p_limit?: number
          p_organization_id: string
          p_timezone: string
          p_to: string
        }
        Returns: Json
      }
      ai_tool_viewed_not_sold: {
        Args: {
          p_from: string
          p_limit?: number
          p_organization_id: string
          p_timezone: string
          p_to: string
        }
        Returns: Json
      }
      allocate_order_branch_inventory: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      apply_order_discount: {
        Args: { p_discount: Json; p_order_id: string }
        Returns: Json
      }
      apply_order_item_discount: {
        Args: { p_discount: Json; p_order_id: string; p_order_item_id: string }
        Returns: Json
      }
      apply_uy_tax_template: { Args: { p_org_id: string }; Returns: undefined }
      calculate_cash_session_expected_amount: {
        Args: { session_id: string }
        Returns: number
      }
      calculate_discount_amount: {
        Args: {
          p_base_amount: number
          p_kind: string
          p_quantity?: number
          p_value: number
        }
        Returns: number
      }
      can_add_org_member: {
        Args: { p_org_id: string; p_target_user_id: string }
        Returns: boolean
      }
      can_manage_storage_object: {
        Args: { p_bucket_id: string; p_path: string }
        Returns: boolean
      }
      cancel_inventory_transfer: {
        Args: { p_transfer_id: string }
        Returns: undefined
      }
      cancel_supplier_invoice: {
        Args: { p_supplier_invoice_id: string }
        Returns: string
      }
      check_branch_limit: { Args: { p_org_id: string }; Returns: boolean }
      check_product_limit: { Args: { p_org_id: string }; Returns: boolean }
      cleanup_old_notifications: { Args: never; Returns: number }
      complete_inventory_transfer: {
        Args: { p_transfer_id: string }
        Returns: string
      }
      compute_order_tax: {
        Args: {
          p_inclusive: boolean
          p_lines: Json
          p_mode?: string
          p_order_discount: Json
        }
        Returns: Json
      }
      confirm_meli_mapping: {
        Args: { p_mapping_id: string }
        Returns: undefined
      }
      convert_quote_to_order: {
        Args: { p_branch_id?: string; p_quote_id: string }
        Returns: string
      }
      create_audit_log:
        | {
            Args: {
              p_action: string
              p_new_data?: Json
              p_notes?: string
              p_old_data?: Json
              p_record_id: string
              p_table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              p_action: string
              p_new_data?: Json
              p_notes?: string
              p_old_data?: Json
              p_organization_id?: string
              p_record_id: string
              p_table_name: string
            }
            Returns: string
          }
      create_full_order_cancellation: {
        Args: {
          p_notes?: string
          p_order_id: string
          p_reason: string
          p_refund_method?: string
        }
        Returns: string
      }
      create_inventory_movement: {
        Args: {
          p_branch_inventory_id: string
          p_movement_type: string
          p_new_stock: number
          p_notes?: string
          p_previous_stock: number
          p_quantity: number
          p_reference_id?: string
          p_reference_type?: string
          p_supplier_id?: string
        }
        Returns: string
      }
      create_inventory_transfer:
        | {
            Args: {
              p_from_branch_id: string
              p_notes?: string
              p_product_id?: string
              p_quantity: number
              p_to_branch_id: string
              p_variant_id?: string
            }
            Returns: string
          }
        | {
            Args: {
              p_from_branch_id: string
              p_notes: string
              p_product_id: string
              p_quantity: number
              p_to_branch_id: string
              p_transfer_type: string
              p_variant_id: string
            }
            Returns: string
          }
      create_meli_order: {
        Args: {
          p_buyer?: Json
          p_items: Json
          p_meli_created_at?: string
          p_meli_order_id: string
          p_org_id: string
          p_totals?: Json
        }
        Returns: string
      }
      debug_can_create_org: {
        Args: never
        Returns: {
          can_bootstrap: boolean
          has_profile: boolean
          is_admin_role: boolean
          org_count: number
          profile_role: string
          uid: string
          would_allow_insert: boolean
        }[]
      }
      decrement_ai_credit: {
        Args: { p_organization_id: string }
        Returns: boolean
      }
      export_financial_report_rows: {
        Args: {
          p_as_of_date?: string
          p_branch_id?: string
          p_limit?: number
          p_offset?: number
          p_organization_id: string
          p_range_end: string
          p_range_start: string
        }
        Returns: {
          extra: Json
          metric_label: string
          row_key: string
          section: string
          value_1: number
          value_2: number
          value_3: number
        }[]
      }
      get_abandoned_mp_orders: {
        Args: never
        Returns: {
          access_token: string
          order_id: string
          organization_id: string
          payment_row_id: string
        }[]
      }
      get_audit_logs: {
        Args: {
          p_action?: string
          p_end_date?: string
          p_limit?: number
          p_offset?: number
          p_organization_id?: string
          p_record_id?: string
          p_start_date?: string
          p_table_name?: string
          p_user_id?: string
        }
        Returns: {
          action: string
          changed_fields: string[]
          created_at: string
          id: string
          new_data: Json
          notes: string
          old_data: Json
          record_id: string
          table_name: string
          user_email: string
          user_id: string
        }[]
      }
      get_customer_report_summary: {
        Args: {
          p_branch_id?: string
          p_organization_id: string
          p_range_end: string
          p_range_start: string
        }
        Returns: Json
      }
      get_customer_snapshot_for_message: {
        Args: { p_customer_id: string; p_organization_id: string }
        Returns: Json
      }
      get_customers_with_order_counts: {
        Args: {
          p_active_only?: boolean
          p_limit?: number
          p_offset?: number
          p_organization_id: string
          p_search?: string
          p_sort_dir?: string
          p_sort_key?: string
          p_tag_id?: string
        }
        Returns: {
          address: Json
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          notes: string
          order_count: number
          organization_id: string
          phone: string
          rut: string
          tags: Json
          total_count: number
          updated_at: string
          user_id: string
        }[]
      }
      get_daily_summary: {
        Args: { p_date: string; p_organization_id: string; p_timezone?: string }
        Returns: {
          order_count: number
          total_expenses: number
          total_sales: number
        }[]
      }
      get_daily_totals_by_branch: {
        Args: { branch_id_param: string; date_param?: string }
        Returns: {
          payment_count: number
          payment_method: string
          total_amount: number
        }[]
      }
      get_dashboard_active_customers: {
        Args: {
          p_from: string
          p_org_id: string
          p_prev_from: string
          p_prev_to: string
          p_to: string
        }
        Returns: {
          current_count: number
          prev_count: number
        }[]
      }
      get_dashboard_daily_sales: {
        Args: { p_from: string; p_org_id: string; p_to: string; p_tz: string }
        Returns: {
          day: string
          orders: number
          revenue: number
        }[]
      }
      get_dashboard_low_stock_items: {
        Args: { p_limit?: number; p_org_id: string }
        Returns: {
          image_url: string
          item_type: string
          name: string
          product_id: string
          sku: string
          stock: number
          variant_id: string
        }[]
      }
      get_dashboard_money_metrics: {
        Args: {
          p_month_start: string
          p_organization_id: string
          p_prev_end: string
          p_prev_start: string
        }
        Returns: Json
      }
      get_dashboard_operational_metrics: {
        Args: {
          p_month_start: string
          p_organization_id: string
          p_prev_end: string
          p_prev_start: string
        }
        Returns: Json
      }
      get_dashboard_sales_by_channel: {
        Args: { p_from: string; p_org_id: string; p_to: string }
        Returns: {
          orders: number
          revenue: number
          source: string
        }[]
      }
      get_dashboard_trends: {
        Args: {
          p_month_start: string
          p_organization_id: string
          p_prev_end: string
          p_prev_start: string
          p_timezone?: string
        }
        Returns: Json
      }
      get_financial_report_summary: {
        Args: {
          p_as_of_date?: string
          p_branch_id?: string
          p_organization_id: string
          p_range_end: string
          p_range_start: string
        }
        Returns: Json
      }
      get_inventory_drift: {
        Args: never
        Returns: {
          branch_id: string
          branch_inventory_id: string
          drift: number
          last_movement_at: string
          last_movement_id: string
          organization_id: string
          product_id: string
          stock_current: number
          stock_expected: number
          variant_id: string
        }[]
      }
      get_inventory_movements: {
        Args: {
          p_branch_inventory_id: string
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          created_at: string
          created_by: string
          id: string
          movement_type: string
          new_stock: number
          notes: string
          previous_stock: number
          quantity: number
          reference_type: string
          supplier_id: string
          supplier_name: string
          user_email: string
        }[]
      }
      get_inventory_valuation_report: {
        Args: { p_branch_id?: string; p_organization_id: string }
        Returns: {
          avg_unit_cost: number
          branch_id: string
          branch_name: string
          product_id: string
          product_name: string
          sku: string
          stock: number
          total_value: number
          variant_id: string
          variant_name: string
        }[]
      }
      get_meli_connection_status: {
        Args: { p_org_id: string }
        Returns: {
          connected: boolean
          connected_at: string
          disconnected_at: string
          meli_user_id: number
          needs_reconnect: boolean
          site_id: string
        }[]
      }
      get_meli_sync_health: { Args: { p_org_id: string }; Returns: Json }
      get_mp_connection_status: {
        Args: { p_org_id: string }
        Returns: {
          connected: boolean
          connected_at: string
          mp_user_id: number
          sandbox: boolean
        }[]
      }
      get_org_by_slug: {
        Args: { p_slug: string }
        Returns: {
          accent_color: string
          border_radius: string
          button_style: string
          cover_image_url: string
          font_family: string
          font_heading: string
          id: string
          logo_url: string
          name: string
          primary_color: string
          secondary_color: string
          settings: Json
          slug: string
        }[]
      }
      get_org_default_low_stock_threshold: {
        Args: { p_organization_id: string }
        Returns: number
      }
      get_org_payment_methods: {
        Args: { p_org_id: string }
        Returns: {
          display_order: number
          id: string
          key: string
          name: string
          requires_cash_session: boolean
        }[]
      }
      get_product_movements: {
        Args: {
          p_limit?: number
          p_movement_type?: string
          p_offset?: number
          p_organization_id: string
          p_product_id: string
        }
        Returns: {
          branch_id: string
          branch_name: string
          created_at: string
          id: string
          movement_type: string
          new_stock: number
          notes: string
          previous_stock: number
          quantity: number
          reference_id: string
          reference_type: string
          total_count: number
        }[]
      }
      get_product_report_summary: {
        Args: {
          p_branch_id?: string
          p_organization_id: string
          p_range_end: string
          p_range_start: string
        }
        Returns: Json
      }
      get_product_stock:
        | {
            Args: {
              p_branch_id?: string
              p_product_id: string
              p_variant_id?: string
            }
            Returns: number
          }
        | {
            Args: {
              p_branch_id?: string
              p_organization_id?: string
              p_product_id: string
              p_variant_id?: string
            }
            Returns: number
          }
      get_products_paginated: {
        Args: {
          p_category_id?: string
          p_is_active?: boolean
          p_limit?: number
          p_offset?: number
          p_organization_id: string
          p_price_max?: number
          p_price_min?: number
          p_search?: string
          p_sort_dir?: string
          p_sort_key?: string
          p_stock_filter?: string
          p_supplier_id?: string
        }
        Returns: {
          category_id: string
          created_at: string
          description: string
          discount_expires_at: string
          discount_percentage: number
          id: string
          image_url: string
          inventory_stock: number
          is_active: boolean
          low_stock_threshold: number
          min_stock: number
          name: string
          organization_id: string
          price: number
          sku: string
          stock: number
          total_count: number
          unit: string
          updated_at: string
        }[]
      }
      get_products_stock:
        | {
            Args: { p_branch_id?: string; p_product_ids: string[] }
            Returns: {
              product_id: string
              stock: number
              variant_id: string
            }[]
          }
        | {
            Args: {
              p_branch_id?: string
              p_organization_id?: string
              p_product_ids: string[]
            }
            Returns: {
              product_id: string
              stock: number
              variant_id: string
            }[]
          }
      get_public_categories: {
        Args: { p_org_id: string }
        Returns: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          name: string
          organization_id: string
          parent_id: string | null
          slug: string
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "categories"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_public_products: {
        Args: { p_org_id: string }
        Returns: {
          category_id: string
          created_at: string | null
          description: string | null
          discount_expires_at: string | null
          discount_percentage: number | null
          id: string
          image_url: string | null
          images: string[] | null
          is_active: boolean | null
          low_stock_threshold: number | null
          min_stock: number | null
          name: string
          organization_id: string
          price: number
          requires_availability_check: boolean
          sku: string
          stock: number
          tax_rate_id: string | null
          unit: string | null
          updated_at: string | null
          visible_in_store: boolean
        }[]
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_reposicion_report: {
        Args: { p_organization_id: string }
        Returns: {
          branch_id: string
          branch_name: string
          dias_stock: number
          low_stock_threshold: number
          min_stock: number
          product_id: string
          product_name: string
          sku: string
          stock_actual: number
          supplier_id: string
          supplier_name: string
          ventas_30d: number
        }[]
      }
      get_sales_report_summary: {
        Args: {
          p_branch_id?: string
          p_compare_end: string
          p_compare_start: string
          p_monthly_start: string
          p_organization_id: string
          p_range_end: string
          p_range_start: string
        }
        Returns: Json
      }
      get_stale_orders_summary: {
        Args: never
        Returns: {
          org_name: string
          organization_id: string
          pending_allocation_count: number
          pending_payment_count: number
          stuck_processing_count: number
          twilio_channel: string
          twilio_phone: string
        }[]
      }
      get_store_analytics: {
        Args: { p_organization_id: string; p_period?: string }
        Returns: Json
      }
      get_store_analytics_v2: {
        Args: {
          p_from: string
          p_organization_id: string
          p_timezone?: string
          p_to: string
        }
        Returns: Json
      }
      get_store_tax_config: { Args: { p_org_id: string }; Returns: Json }
      get_stuck_mp_orders: {
        Args: never
        Returns: {
          access_token: string
          order_id: string
          organization_id: string
          payment_row_id: string
        }[]
      }
      get_user_organization_ids: { Args: never; Returns: string[] }
      get_wholesale_catalog_by_token: {
        Args: { p_token: string }
        Returns: Json
      }
      has_org_permission: {
        Args: { p_org_id: string; p_permission_key: string }
        Returns: boolean
      }
      increment_ai_credit: {
        Args: { p_organization_id: string }
        Returns: undefined
      }
      is_admin: { Args: { user_id_param: string }; Returns: boolean }
      is_org_admin: { Args: { p_org_id: string }; Returns: boolean }
      is_org_admin_or_manager: { Args: { p_org_id: string }; Returns: boolean }
      is_org_member: { Args: { p_org_id: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      list_active_sales_discount_rules: {
        Args: { p_organization_id: string; p_scope?: string }
        Returns: {
          ends_at: string
          id: string
          is_active: boolean
          kind: string
          max_discount_amount: number
          min_order_total: number
          name: string
          scope: string
          starts_at: string
          value: number
        }[]
      }
      mark_notifications_read: {
        Args: { p_ids?: string[]; p_org_id: string }
        Returns: undefined
      }
      meli_acquire_refresh_lease: {
        Args: { p_org_id: string; p_ttl_seconds?: number }
        Returns: string
      }
      meli_backoff_delay: { Args: { p_attempts: number }; Returns: string }
      meli_claim_sync_job: {
        Args: { p_queue_id: string }
        Returns: {
          attempts: number
          claim_token: string
          desired_quantity: number
          force: boolean
          last_pushed_quantity: number
          last_sync_ok: boolean
          mapping_id: string
          meli_item_id: string
          meli_variation_id: string
          organization_id: string
          queue_id: string
          reason: string
          sync_active: boolean
        }[]
      }
      meli_claim_webhook_job: {
        Args: { p_queue_id: string }
        Returns: {
          attempts: number
          claim_token: string
          meli_user_id: number
          organization_id: string
          queue_id: string
          resource: string
          topic: string
        }[]
      }
      meli_complete_sync_job: {
        Args: {
          p_claim_token: string
          p_error?: string
          p_outcome: string
          p_pushed_quantity?: number
          p_queue_id: string
          p_retry_after_seconds?: number
        }
        Returns: string
      }
      meli_complete_webhook_job: {
        Args: {
          p_claim_token: string
          p_error?: string
          p_hold_reason?: string
          p_outcome: string
          p_queue_id: string
          p_retry_after_seconds?: number
        }
        Returns: string
      }
      meli_dispatch_due_jobs: {
        Args: { p_sync_limit?: number; p_webhook_limit?: number }
        Returns: Json
      }
      meli_enqueue_full_resync: { Args: { p_org_id: string }; Returns: number }
      meli_enqueue_post_sale_push: {
        Args: { p_meli_order_id: string; p_org_id: string }
        Returns: number
      }
      meli_enqueue_stock_push: {
        Args: { p_force?: boolean; p_mapping_id: string; p_reason?: string }
        Returns: undefined
      }
      meli_find_confirmed_mapping: {
        Args: { p_org_id: string; p_product_id: string; p_variant_id: string }
        Returns: string
      }
      meli_fold_text: { Args: { p_text: string }; Returns: string }
      meli_intake_item_webhook: {
        Args: { p_meli_user_id: number; p_resource: string }
        Returns: string
      }
      meli_intake_webhook: {
        Args: { p_meli_user_id: number; p_resource: string; p_topic: string }
        Returns: string
      }
      meli_invoke_edge_function: {
        Args: { p_body: Json; p_url_key: string }
        Returns: number
      }
      meli_listing_titles_for_mappings: {
        Args: { p_mapping_ids: string[]; p_org_id: string }
        Returns: {
          mapping_id: string
          title: string
        }[]
      }
      meli_listings_apply_items: {
        Args: {
          p_claim_token: string
          p_gone_item_ids: string[]
          p_org_id: string
          p_rows: Json
        }
        Returns: undefined
      }
      meli_listings_begin_run: {
        Args: { p_org_id: string; p_ttl_seconds?: number }
        Returns: Json
      }
      meli_listings_claim_items: {
        Args: { p_limit?: number; p_org_id: string }
        Returns: {
          claim_token: string
          meli_item_id: string
          queue_id: string
        }[]
      }
      meli_listings_complete_run: {
        Args: { p_lease_token: string; p_org_id: string; p_run_id: string }
        Returns: string
      }
      meli_listings_dispatch: {
        Args: { p_full_limit?: number; p_items_org_limit?: number }
        Returns: Json
      }
      meli_listings_pause_run: {
        Args: {
          p_error: string
          p_lease_token: string
          p_org_id: string
          p_reset?: boolean
          p_retry_after_seconds?: number
        }
        Returns: undefined
      }
      meli_listings_purge: { Args: never; Returns: undefined }
      meli_listings_release_items: {
        Args: { p_claim_token: string; p_error: string; p_org_id: string }
        Returns: undefined
      }
      meli_listings_request_due_refreshes: {
        Args: { p_limit?: number }
        Returns: number
      }
      meli_listings_request_refresh: {
        Args: { p_org_id: string }
        Returns: Json
      }
      meli_listings_requeue_item: {
        Args: { p_error: string; p_queue_id: string }
        Returns: undefined
      }
      meli_listings_upsert_page: {
        Args: {
          p_expected_total: number
          p_item_ids: string[]
          p_lease_token: string
          p_next_offset: number
          p_org_id: string
          p_rows: Json
          p_run_id: string
          p_unresolved_ids?: string[]
        }
        Returns: undefined
      }
      meli_match_skus: {
        Args: { p_org_id: string; p_skus: string[] }
        Returns: {
          product_id: string
          sku: string
          variant_id: string
        }[]
      }
      meli_maybe_enqueue_sync_alert: {
        Args: { p_kind: string; p_org_id: string }
        Returns: boolean
      }
      meli_purge_queues: { Args: never; Returns: undefined }
      meli_reconcile_candidates: {
        Args: { p_limit?: number }
        Returns: {
          desired_quantity: number
          mapping_id: string
          meli_item_id: string
          meli_variation_id: string
          organization_id: string
        }[]
      }
      meli_record_reconcile_results: {
        Args: { p_checked: string[]; p_drifted: string[] }
        Returns: undefined
      }
      meli_record_refresh_failure: {
        Args: { p_error: string; p_is_auth: boolean; p_org_id: string }
        Returns: boolean
      }
      meli_release_held_and_resync: {
        Args: { p_org_id: string }
        Returns: Json
      }
      meli_release_refresh_lease: {
        Args: { p_org_id: string; p_token: string }
        Returns: undefined
      }
      meli_resync_all: { Args: { p_org_id: string }; Returns: Json }
      meli_retry_mapping: { Args: { p_mapping_id: string }; Returns: undefined }
      order_status_label: { Args: { p_status: string }; Returns: string }
      org_has_no_members: { Args: { p_org_id: string }; Returns: boolean }
      populate_missing_inventory_entries: {
        Args: never
        Returns: {
          created_count: number
        }[]
      }
      populate_missing_inventory_entries_rpc: {
        Args: { p_organization_id?: string }
        Returns: number
      }
      post_goods_receipt: {
        Args: { p_goods_receipt_id: string }
        Returns: string
      }
      post_supplier_invoice: {
        Args: { p_supplier_invoice_id: string }
        Returns: string
      }
      process_partial_order_return: {
        Args: {
          p_items: Json
          p_notes?: string
          p_order_id: string
          p_reason: string
          p_refund_method?: string
        }
        Returns: string
      }
      recalculate_order_totals: { Args: { p_order_id: string }; Returns: Json }
      recalculate_purchase_order_totals: {
        Args: { p_purchase_order_id: string }
        Returns: undefined
      }
      recalculate_quote_totals: { Args: { p_quote_id: string }; Returns: Json }
      receive_inventory: {
        Args: {
          p_branch_inventory_id: string
          p_notes?: string
          p_quantity: number
          p_supplier_id?: string
        }
        Returns: string
      }
      refresh_financial_reporting_materialized_views: {
        Args: never
        Returns: Json
      }
      register_manual_sale: {
        Args: {
          p_apply_tax?: boolean
          p_branch_id: string
          p_client_request_id?: string
          p_customer?: Json
          p_discount?: Json
          p_lines: Json
          p_notes?: string
          p_organization_id: string
          p_payment_method?: string
          p_sale_condition: string
          p_sale_date?: string
        }
        Returns: Json
      }
      register_org_payment: {
        Args: {
          p_amount: number
          p_covered_from: string
          p_notes?: string
          p_organization_id: string
          p_period_months: number
          p_plan: string
        }
        Returns: string
      }
      register_supplier_payment: {
        Args: {
          p_amount: number
          p_notes?: string
          p_payment_date?: string
          p_payment_method: string
          p_reference_number?: string
          p_supplier_invoice_id: string
        }
        Returns: string
      }
      remove_order_discount: {
        Args: { p_order_id: string; p_reason?: string }
        Returns: Json
      }
      remove_order_item_discount: {
        Args: { p_order_id: string; p_order_item_id: string; p_reason?: string }
        Returns: Json
      }
      resolve_storefront_branch_id: {
        Args: {
          p_exclude_isolated_warehouses?: boolean
          p_organization_id: string
        }
        Returns: string
      }
      restore_meli_order: {
        Args: { p_lines?: Json; p_meli_order_id: string; p_org_id: string }
        Returns: string
      }
      rotate_wholesale_catalog_token: {
        Args: { p_catalog_id: string }
        Returns: string
      }
      search_meli_listings: {
        Args: {
          p_include_closed?: boolean
          p_limit?: number
          p_offset?: number
          p_org_id: string
          p_search?: string
          p_state?: string
        }
        Returns: {
          available_quantity: number
          first_push_confirmed_at: string
          health_last_error: string
          health_next_attempt_at: string
          last_sync_error: string
          last_synced_at: string
          listing_status: string
          mapped_label: string
          mapping_id: string
          mapping_status: string
          match_source: string
          meli_item_id: string
          meli_variation_id: string
          missing_since: string
          online_branch_stock: number
          permalink: string
          product_id: string
          row_state: string
          sku: string
          suggested_product_id: string
          suggested_variant_id: string
          thumbnail_url: string
          title: string
          total_count: number
          variant_id: string
        }[]
      }
      search_meli_mapping_candidates: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_org_id: string
          p_search?: string
        }
        Returns: {
          label: string
          mapped_meli_item_id: string
          product_id: string
          sku: string
          total_count: number
          variant_id: string
        }[]
      }
      seed_org_system_roles: { Args: { p_org_id: string }; Returns: undefined }
      set_default_tax_rate: { Args: { p_rate_id: string }; Returns: undefined }
      set_wholesale_price_tiers: {
        Args: { p_catalog_product_id: string; p_tiers: Json }
        Returns: undefined
      }
      sync_inventory_from_master_stock: {
        Args: {
          p_branch_id?: string
          p_only_desynced?: boolean
          p_organization_id: string
        }
        Returns: number
      }
      sync_supplier_invoice_payment_totals: {
        Args: { p_supplier_invoice_id: string }
        Returns: undefined
      }
      trigger_daily_summary_edge: { Args: never; Returns: undefined }
      update_meli_sync_settings: {
        Args: {
          p_alert_email_enabled: boolean
          p_alert_email_recipient: string
          p_org_id: string
          p_safety_reserve: number
          p_stock_sync_mode: string
          p_sync_enabled: boolean
        }
        Returns: undefined
      }
      update_order_with_items: {
        Args: {
          p_client_total?: number
          p_items: Json
          p_order_id: string
          p_payment_amount?: number
          p_payment_method: string
          p_removed_item_ids?: string[]
          p_shipping_address: Json
        }
        Returns: Json
      }
      update_product_stock_with_inventory: {
        Args: {
          p_branch_id: string
          p_new_stock: number
          p_product_id: string
          p_reason?: string
        }
        Returns: Json
      }
      validate_barcode_format: {
        Args: {
          barcode_type_value: Database["public"]["Enums"]["barcode_type"]
          barcode_value: string
        }
        Returns: boolean
      }
      validate_store_coupon: {
        Args: { p_code: string; p_organization_id: string }
        Returns: {
          amount: number
          code: string
          id: string
          is_active: boolean
          kind: string
          valid_until: string
        }[]
      }
    }
    Enums: {
      barcode_type:
        | "EAN13"
        | "EAN8"
        | "UPC"
        | "CODE128"
        | "CODE39"
        | "INTERNAL"
        | "SUPPLIER"
        | "OTHER"
      order_status:
        | "pending"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "pending_allocation"
      payment_method: "transfer" | "mercadopago" | "cash"
      quote_status:
        | "draft"
        | "sent"
        | "accepted"
        | "rejected"
        | "expired"
        | "converted"
      user_role: "user" | "admin" | "manager" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      barcode_type: [
        "EAN13",
        "EAN8",
        "UPC",
        "CODE128",
        "CODE39",
        "INTERNAL",
        "SUPPLIER",
        "OTHER",
      ],
      order_status: [
        "pending",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "pending_allocation",
      ],
      payment_method: ["transfer", "mercadopago", "cash"],
      quote_status: [
        "draft",
        "sent",
        "accepted",
        "rejected",
        "expired",
        "converted",
      ],
      user_role: ["user", "admin", "manager", "viewer"],
    },
  },
} as const
