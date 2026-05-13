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
          is_isolated_warehouse: boolean
          is_active: boolean | null
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
          email?: string | null
          id?: string
          is_isolated_warehouse?: boolean
          is_active?: boolean | null
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
          is_isolated_warehouse?: boolean
          is_active?: boolean | null
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
      inventory_lots: {
        Row: {
          id: string
          organization_id: string
          branch_id: string
          product_id: string | null
          variant_id: string | null
          received_at: string
          expires_at: string | null
          quantity_received: number
          quantity_remaining: number
          quantity_damaged: number
          unit_cost: number | null
          supplier_id: string | null
          reference_document: string | null
          status: 'active' | 'exhausted' | 'written_off'
          writeoff_reason: string | null
          writeoff_at: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          branch_id: string
          product_id?: string | null
          variant_id?: string | null
          received_at?: string
          expires_at?: string | null
          quantity_received: number
          quantity_remaining: number
          quantity_damaged?: number
          unit_cost?: number | null
          supplier_id?: string | null
          reference_document?: string | null
          status?: 'active' | 'exhausted' | 'written_off'
          writeoff_reason?: string | null
          writeoff_at?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          branch_id?: string
          product_id?: string | null
          variant_id?: string | null
          received_at?: string
          expires_at?: string | null
          quantity_received?: number
          quantity_remaining?: number
          quantity_damaged?: number
          unit_cost?: number | null
          supplier_id?: string | null
          reference_document?: string | null
          status?: 'active' | 'exhausted' | 'written_off'
          writeoff_reason?: string | null
          writeoff_at?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_lots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_lots_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
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
        ]
      }
      inventory_movements: {
        Row: {
          branch_inventory_id: string
          created_at: string | null
          created_by: string | null
          id: string
          movement_type: string
          new_stock: number
          notes: string | null
          previous_stock: number
          quantity: number
          reference_id: string | null
          reference_type: string | null
          supplier_id: string | null
        }
        Insert: {
          branch_inventory_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          movement_type: string
          new_stock: number
          notes?: string | null
          previous_stock: number
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          supplier_id?: string | null
        }
        Update: {
          branch_inventory_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          movement_type?: string
          new_stock?: number
          notes?: string | null
          previous_stock?: number
          quantity?: number
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
          order_id: string
          price: number
          product_id: string
          quantity: number
          returned_quantity: number
          variant_id: string | null
        }
        Insert: {
          base_unit_price?: number
          cost_at_sale?: number | null
          cost_source?: string | null
          created_at?: string | null
          discount_amount?: number
          discount_metadata?: Json | null
          id?: string
          margin_at_sale?: number | null
          margin_percentage_at_sale?: number | null
          order_id: string
          price: number
          product_id: string
          quantity: number
          returned_quantity?: number
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
          order_id?: string
          price?: number
          product_id?: string
          quantity?: number
          returned_quantity?: number
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
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_payments: {
        Row: {
          amount: number
          cash_session_id: string | null
          created_at: string | null
          id: string
          notes: string | null
          order_id: string
          payment_method: string
          mp_payment_id: string | null
          mp_status: string | null
        }
        Insert: {
          amount: number
          cash_session_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          order_id: string
          payment_method: string
          mp_payment_id?: string | null
          mp_status?: string | null
        }
        Update: {
          amount?: number
          cash_session_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          payment_method?: string
          mp_payment_id?: string | null
          mp_status?: string | null
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
      orders: {
        Row: {
          branch_id: string | null
          created_at: string | null
          customer_id: string | null
          discount_metadata: Json | null
          discount_total: number
          id: string
          order_number: number | null
          organization_id: string
          payment_method: string | null
          shipping_address: Json
          status: Database["public"]["Enums"]["order_status"] | null
          subtotal_before_discount: number
          tax_total: number
          total: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          discount_metadata?: Json | null
          discount_total?: number
          id?: string
          order_number?: number | null
          organization_id: string
          payment_method?: string | null
          shipping_address: Json
          status?: Database["public"]["Enums"]["order_status"] | null
          subtotal_before_discount?: number
          tax_total?: number
          total: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          discount_metadata?: Json | null
          discount_total?: number
          id?: string
          order_number?: number | null
          organization_id?: string
          payment_method?: string | null
          shipping_address?: Json
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
      organization_members: {
        Row: {
          created_at: string | null
          id: string
          invited_by: string | null
          joined_at: string | null
          organization_id: string
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
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
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
      organizations: {
        Row: {
          accent_color: string | null
          border_radius: string | null
          button_style: string | null
          cover_image_url: string | null
          created_at: string | null
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
          subscription_status: string | null
          subscription_tier: string | null
          trial_ends_at: string | null
          subscription_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          border_radius?: string | null
          button_style?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          font_family?: string | null
          font_heading?: string | null
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string | null
          secondary_color?: string | null
          settings?: Json | null
          slug: string
          subscription_status?: string | null
          subscription_tier?: string | null
          trial_ends_at?: string | null
          subscription_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          border_radius?: string | null
          button_style?: string | null
          cover_image_url?: string | null
          created_at?: string | null
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
          subscription_status?: string | null
          subscription_tier?: string | null
          trial_ends_at?: string | null
          subscription_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
          sku: string
          stock: number
          unit: string | null
          updated_at: string | null
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
          sku: string
          stock?: number
          unit?: string | null
          updated_at?: string | null
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
          sku?: string
          stock?: number
          unit?: string | null
          updated_at?: string | null
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
    }
    Views: {
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
      calculate_cash_session_expected_amount: {
        Args: { session_id: string }
        Returns: number
      }
      can_create_organization: { Args: never; Returns: boolean }
      can_manage_storage_object: {
        Args: { p_bucket_id: string; p_path: string }
        Returns: boolean
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
      check_branch_limit: { Args: { p_org_id: string }; Returns: boolean }
      check_product_limit: { Args: { p_org_id: string }; Returns: boolean }
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
      create_inventory_transfer: {
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
      get_daily_totals_by_branch: {
        Args: { branch_id_param: string; date_param?: string }
        Returns: {
          payment_count: number
          payment_method: string
          total_amount: number
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
          id: string
          image_url: string | null
          images: string[] | null
          is_active: boolean | null
          low_stock_threshold: number | null
          min_stock: number | null
          name: string
          organization_id: string
          price: number
          sku: string
          stock: number
          unit: string | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: false
          isSetofReturn: true
        }
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
          value_1: number | null
          value_2: number | null
          value_3: number | null
        }[]
      }
      refresh_financial_reporting_materialized_views: {
        Args: Record<PropertyKey, never>
        Returns: Json
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
      get_user_organization_ids: { Args: never; Returns: string[] }
      has_org_permission: {
        Args: { p_org_id: string; p_permission_key: string }
        Returns: boolean
      }
      is_admin: { Args: { user_id_param: string }; Returns: boolean }
      is_org_admin: { Args: { p_org_id: string }; Returns: boolean }
      is_org_admin_or_manager: { Args: { p_org_id: string }; Returns: boolean }
      is_org_member: { Args: { p_org_id: string }; Returns: boolean }
      populate_missing_inventory_entries_rpc: {
        Args: { p_organization_id?: string }
        Returns: number
      }
      validate_barcode_format: {
        Args: {
          barcode_type_value: Database["public"]["Enums"]["barcode_type"]
          barcode_value: string
        }
        Returns: boolean
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
        | "pending_allocation"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
      payment_method: "transfer" | "mercadopago" | "cash"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
        "pending_allocation",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      payment_method: ["transfer", "mercadopago", "cash"],
      user_role: ["user", "admin", "manager", "viewer"],
    },
  },
} as const

// Backward-compatible domain aliases used across the app
export type AuditLog = Tables<'audit_logs'>
export type AuditLogInsert = TablesInsert<'audit_logs'>
export type AuditLogUpdate = TablesUpdate<'audit_logs'>

export type Branch = Tables<'branches'>
export type BranchInsert = TablesInsert<'branches'>
export type BranchUpdate = TablesUpdate<'branches'>
export type BranchInventory = Tables<'branch_inventory'>
export type BranchInventoryInsert = TablesInsert<'branch_inventory'>
export type BranchInventoryUpdate = TablesUpdate<'branch_inventory'>

export type CartItem = Tables<'cart_items'>
export type CartItemInsert = TablesInsert<'cart_items'>
export type CartItemUpdate = TablesUpdate<'cart_items'>

export type CashSession = Tables<'cash_sessions'>
export type CashSessionInsert = TablesInsert<'cash_sessions'>
export type CashSessionUpdate = TablesUpdate<'cash_sessions'>

export type Category = Tables<'categories'>
export type CategoryInsert = TablesInsert<'categories'>
export type CategoryUpdate = TablesUpdate<'categories'>

export type Customer = Tables<'customers'>
export type CustomerInsert = TablesInsert<'customers'>
export type CustomerUpdate = TablesUpdate<'customers'>

export type InventoryLot = Tables<'inventory_lots'>
export type InventoryLotInsert = TablesInsert<'inventory_lots'>
export type InventoryLotUpdate = TablesUpdate<'inventory_lots'>

export type InventoryMovement = Tables<'inventory_movements'>
export type InventoryMovementInsert = TablesInsert<'inventory_movements'>
export type InventoryMovementUpdate = TablesUpdate<'inventory_movements'>

export type InventoryTransfer = Tables<'inventory_transfers'>
export type InventoryTransferInsert = TablesInsert<'inventory_transfers'>
export type InventoryTransferUpdate = TablesUpdate<'inventory_transfers'>

export type Order = Tables<'orders'>
export type OrderInsert = TablesInsert<'orders'>
export type OrderUpdate = TablesUpdate<'orders'>

export type OrderItem = Tables<'order_items'>
export type OrderItemInsert = TablesInsert<'order_items'>
export type OrderItemUpdate = TablesUpdate<'order_items'>

export type OrderPayment = Tables<'order_payments'>
export type OrderPaymentInsert = TablesInsert<'order_payments'>
export type OrderPaymentUpdate = TablesUpdate<'order_payments'>

export type Organization = Tables<'organizations'>
export type OrganizationInsert = TablesInsert<'organizations'>
export type OrganizationUpdate = TablesUpdate<'organizations'>
export type OrganizationMember = Tables<'organization_members'>
export type OrganizationMemberInsert = TablesInsert<'organization_members'>
export type OrganizationMemberUpdate = TablesUpdate<'organization_members'>
export type OrganizationPaymentMethod = Tables<'organization_payment_methods'>
export type OrganizationPaymentMethodInsert = TablesInsert<'organization_payment_methods'>
export type OrganizationPaymentMethodUpdate = TablesUpdate<'organization_payment_methods'>
export type OrganizationSettings = {
  currency?: string | null
  locale?: string | null
  timezone?: string | null
  decimal_places?: number | null
  default_low_stock_threshold?: number | null
  transfer_contact_phone?: string | null
  consignment_enabled?: boolean | null
  consignment_allow_seller_to_seller?: boolean | null
  consignment_default_warehouse_branch_id?: string | null
  checkout_fulfillment_mode?: 'auto' | 'main' | null
  checkout_exclude_isolated_warehouses?: boolean | null
  checkout_stock_allocation_mode?: 'immediate' | 'manual' | null
  inventory_transfer_completion_mode?: 'manual' | 'automatic' | null
  costing_method?: 'weighted_average' | 'fifo' | null
  store_logo_minimal_url?: string | null
  store_cover_image_urls?: string[] | null
  [key: string]: unknown
}

export type Permission = Tables<'permissions'>
export type PermissionInsert = TablesInsert<'permissions'>
export type PermissionUpdate = TablesUpdate<'permissions'>

export type Product = Tables<'products'>
export type ProductInsert = TablesInsert<'products'>
export type ProductUpdate = TablesUpdate<'products'>

export type ProductVariant = Tables<'product_variants'>
export type ProductVariantInsert = TablesInsert<'product_variants'>
export type ProductVariantUpdate = TablesUpdate<'product_variants'>

export type ProductImage = Tables<'product_images'>
export type ProductImageInsert = TablesInsert<'product_images'>
export type ProductImageUpdate = TablesUpdate<'product_images'>

export type ProductBarcode = Tables<'product_barcodes'>
export type ProductBarcodeInsert = TablesInsert<'product_barcodes'>
export type ProductBarcodeUpdate = TablesUpdate<'product_barcodes'>

export type ProductSupplier = Tables<'product_suppliers'>
export type ProductSupplierInsert = TablesInsert<'product_suppliers'>
export type ProductSupplierUpdate = TablesUpdate<'product_suppliers'>

export type Role = Tables<'roles'>
export type RoleInsert = TablesInsert<'roles'>
export type RoleUpdate = TablesUpdate<'roles'>
export type RolePermission = Tables<'roles_permissions'>
export type RolePermissionInsert = TablesInsert<'roles_permissions'>
export type RolePermissionUpdate = TablesUpdate<'roles_permissions'>

export type Supplier = Tables<'suppliers'>
export type SupplierInsert = TablesInsert<'suppliers'>
export type SupplierUpdate = TablesUpdate<'suppliers'>

export type UserProfile = Tables<'user_profiles'>
export type UserProfileInsert = TablesInsert<'user_profiles'>
export type UserProfileUpdate = TablesUpdate<'user_profiles'>
