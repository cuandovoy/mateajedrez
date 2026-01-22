export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string
          name: string
          description: string | null
          slug: string
          image_url: string | null
          parent_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          slug: string
          image_url?: string | null
          parent_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          slug?: string
          image_url?: string | null
          parent_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          name: string
          description: string | null
          price: number
          stock: number
          category_id: string
          image_url: string | null
          images: string[] | null
          sku: string
          is_active: boolean
          unit: string | null
          min_stock: number
          low_stock_threshold: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          price: number
          stock: number
          category_id: string
          image_url?: string | null
          images?: string[] | null
          sku: string
          is_active?: boolean
          unit?: string | null
          min_stock?: number
          low_stock_threshold?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          price?: number
          stock?: number
          category_id?: string
          image_url?: string | null
          images?: string[] | null
          sku?: string
          is_active?: boolean
          unit?: string | null
          min_stock?: number
          low_stock_threshold?: number
          created_at?: string
          updated_at?: string
        }
      }
      product_variants: {
        Row: {
          id: string
          product_id: string
          sku: string
          name: string | null
          attributes: Json | null
          price: number | null
          stock: number
          is_active: boolean
          image_url: string | null
          unit: string | null
          min_stock: number
          low_stock_threshold: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          sku: string
          name?: string | null
          attributes?: Json | null
          price?: number | null
          stock?: number
          is_active?: boolean
          image_url?: string | null
          unit?: string | null
          min_stock?: number
          low_stock_threshold?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          sku?: string
          name?: string | null
          attributes?: Json | null
          price?: number | null
          stock?: number
          is_active?: boolean
          image_url?: string | null
          unit?: string | null
          min_stock?: number
          low_stock_threshold?: number
          created_at?: string
          updated_at?: string
        }
      }
      product_images: {
        Row: {
          id: string
          product_id: string
          image_url: string
          display_order: number
          is_primary: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          image_url: string
          display_order?: number
          is_primary?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          image_url?: string
          display_order?: number
          is_primary?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      product_barcodes: {
        Row: {
          id: string
          product_id: string | null
          variant_id: string | null
          barcode: string
          barcode_type: 'EAN13' | 'EAN8' | 'UPC' | 'CODE128' | 'CODE39' | 'INTERNAL' | 'SUPPLIER' | 'OTHER'
          is_primary: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id?: string | null
          variant_id?: string | null
          barcode: string
          barcode_type?: 'EAN13' | 'EAN8' | 'UPC' | 'CODE128' | 'CODE39' | 'INTERNAL' | 'SUPPLIER' | 'OTHER'
          is_primary?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string | null
          variant_id?: string | null
          barcode?: string
          barcode_type?: 'EAN13' | 'EAN8' | 'UPC' | 'CODE128' | 'CODE39' | 'INTERNAL' | 'SUPPLIER' | 'OTHER'
          is_primary?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      suppliers: {
        Row: {
          id: string
          name: string
          contact_name: string | null
          email: string | null
          phone: string | null
          address: string | null
          city: string | null
          country: string | null
          postal_code: string | null
          tax_id: string | null
          website: string | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          contact_name?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          country?: string | null
          postal_code?: string | null
          tax_id?: string | null
          website?: string | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          contact_name?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          city?: string | null
          country?: string | null
          postal_code?: string | null
          tax_id?: string | null
          website?: string | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      product_suppliers: {
        Row: {
          id: string
          product_id: string
          supplier_id: string
          supplier_sku: string | null
          supplier_price: number | null
          lead_time_days: number | null
          min_order_quantity: number
          is_primary: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          supplier_id: string
          supplier_sku?: string | null
          supplier_price?: number | null
          lead_time_days?: number | null
          min_order_quantity?: number
          is_primary?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          supplier_id?: string
          supplier_sku?: string | null
          supplier_price?: number | null
          lead_time_days?: number | null
          min_order_quantity?: number
          is_primary?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      cart_items: {
        Row: {
          id: string
          user_id: string
          product_id: string
          variant_id: string | null
          quantity: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_id: string
          variant_id?: string | null
          quantity: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string
          variant_id?: string | null
          quantity?: number
          created_at?: string
          updated_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          user_id: string | null
          total: number
          status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
          shipping_address: Json
          payment_method: 'transfer' | 'mercadopago' | 'cash'
          branch_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          total: number
          status?: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
          shipping_address: Json
          payment_method?: 'transfer' | 'mercadopago' | 'cash'
          branch_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          total?: number
          status?: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
          shipping_address?: Json
          payment_method?: 'transfer' | 'mercadopago' | 'cash'
          branch_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          variant_id: string | null
          quantity: number
          price: number
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          variant_id?: string | null
          quantity: number
          price: number
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string
          variant_id?: string | null
          quantity?: number
          price?: number
          created_at?: string
        }
      }
      user_profiles: {
        Row: {
          id: string
          user_id: string | null
          role: 'user' | 'admin'
          full_name: string | null
          phone: string | null
          address: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          role?: 'user' | 'admin'
          full_name?: string | null
          phone?: string | null
          address?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          role?: 'user' | 'admin'
          full_name?: string | null
          phone?: string | null
          address?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      branches: {
        Row: {
          id: string
          name: string
          code: string | null
          address: string | null
          city: string | null
          country: string | null
          postal_code: string | null
          phone: string | null
          email: string | null
          is_active: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          code?: string | null
          address?: string | null
          city?: string | null
          country?: string | null
          postal_code?: string | null
          phone?: string | null
          email?: string | null
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          code?: string | null
          address?: string | null
          city?: string | null
          country?: string | null
          postal_code?: string | null
          phone?: string | null
          email?: string | null
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      branch_inventory: {
        Row: {
          id: string
          branch_id: string
          product_id: string | null
          variant_id: string | null
          stock: number
          min_stock: number
          low_stock_threshold: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          branch_id: string
          product_id?: string | null
          variant_id?: string | null
          stock?: number
          min_stock?: number
          low_stock_threshold?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          branch_id?: string
          product_id?: string | null
          variant_id?: string | null
          stock?: number
          min_stock?: number
          low_stock_threshold?: number
          created_at?: string
          updated_at?: string
        }
      }
      cash_sessions: {
        Row: {
          id: string
          branch_id: string
          opening_amount: number
          expected_amount: number | null
          closing_amount: number | null
          difference: number | null
          opened_by: string | null
          closed_by: string | null
          opened_at: string
          closed_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          branch_id: string
          opening_amount?: number
          expected_amount?: number | null
          closing_amount?: number | null
          difference?: number | null
          opened_by?: string | null
          closed_by?: string | null
          opened_at?: string
          closed_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          branch_id?: string
          opening_amount?: number
          expected_amount?: number | null
          closing_amount?: number | null
          difference?: number | null
          opened_by?: string | null
          closed_by?: string | null
          opened_at?: string
          closed_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      order_payments: {
        Row: {
          id: string
          order_id: string
          payment_method: 'transfer' | 'mercadopago' | 'cash'
          amount: number
          cash_session_id: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          payment_method: 'transfer' | 'mercadopago' | 'cash'
          amount: number
          cash_session_id?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          payment_method?: 'transfer' | 'mercadopago' | 'cash'
          amount?: number
          cash_session_id?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          table_name: string
          record_id: string | null
          action: string
          user_id: string | null
          old_data: Json | null
          new_data: Json | null
          changed_fields: string[] | null
          ip_address: string | null
          user_agent: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          table_name: string
          record_id?: string | null
          action: string
          user_id?: string | null
          old_data?: Json | null
          new_data?: Json | null
          changed_fields?: string[] | null
          ip_address?: string | null
          user_agent?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          table_name?: string
          record_id?: string | null
          action?: string
          user_id?: string | null
          old_data?: Json | null
          new_data?: Json | null
          changed_fields?: string[] | null
          ip_address?: string | null
          user_agent?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      inventory_movements: {
        Row: {
          id: string
          branch_inventory_id: string
          movement_type: string
          quantity: number
          previous_stock: number
          new_stock: number
          reference_id: string | null
          reference_type: string | null
          notes: string | null
          created_by: string | null
          supplier_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          branch_inventory_id: string
          movement_type: string
          quantity: number
          previous_stock: number
          new_stock: number
          reference_id?: string | null
          reference_type?: string | null
          notes?: string | null
          created_by?: string | null
          supplier_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          branch_inventory_id?: string
          movement_type?: string
          quantity?: number
          previous_stock?: number
          new_stock?: number
          reference_id?: string | null
          reference_type?: string | null
          notes?: string | null
          created_by?: string | null
          supplier_id?: string | null
          created_at?: string
        }
      }
      inventory_transfers: {
        Row: {
          id: string
          from_branch_id: string
          to_branch_id: string
          product_id: string | null
          variant_id: string | null
          quantity: number
          status: string
          notes: string | null
          created_by: string | null
          completed_by: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          from_branch_id: string
          to_branch_id: string
          product_id?: string | null
          variant_id?: string | null
          quantity: number
          status?: string
          notes?: string | null
          created_by?: string | null
          completed_by?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          from_branch_id?: string
          to_branch_id?: string
          product_id?: string | null
          variant_id?: string | null
          quantity?: number
          status?: string
          notes?: string | null
          created_by?: string | null
          completed_by?: string | null
          created_at?: string
          completed_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      order_status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
      user_role: 'user' | 'admin'
      barcode_type: 'EAN13' | 'EAN8' | 'UPC' | 'CODE128' | 'CODE39' | 'INTERNAL' | 'SUPPLIER' | 'OTHER'
      payment_method: 'transfer' | 'mercadopago' | 'cash'
    }
  }
}

// Type helpers
export type Category = Database['public']['Tables']['categories']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type ProductVariant = Database['public']['Tables']['product_variants']['Row']
export type ProductImage = Database['public']['Tables']['product_images']['Row']
export type ProductBarcode = Database['public']['Tables']['product_barcodes']['Row']
export type Supplier = Database['public']['Tables']['suppliers']['Row']
export type ProductSupplier = Database['public']['Tables']['product_suppliers']['Row']
export type CartItem = Database['public']['Tables']['cart_items']['Row']
export type Order = Database['public']['Tables']['orders']['Row']
export type OrderItem = Database['public']['Tables']['order_items']['Row']
export type UserProfile = Database['public']['Tables']['user_profiles']['Row']
export type Branch = Database['public']['Tables']['branches']['Row']
export type BranchInventory = Database['public']['Tables']['branch_inventory']['Row']
export type CashSession = Database['public']['Tables']['cash_sessions']['Row']
export type OrderPayment = Database['public']['Tables']['order_payments']['Row']
export type AuditLog = Database['public']['Tables']['audit_logs']['Row']
export type InventoryMovement = Database['public']['Tables']['inventory_movements']['Row']
export type InventoryTransfer = Database['public']['Tables']['inventory_transfers']['Row']

export type CategoryInsert = Database['public']['Tables']['categories']['Insert']
export type ProductInsert = Database['public']['Tables']['products']['Insert']
export type ProductVariantInsert = Database['public']['Tables']['product_variants']['Insert']
export type ProductImageInsert = Database['public']['Tables']['product_images']['Insert']
export type ProductBarcodeInsert = Database['public']['Tables']['product_barcodes']['Insert']
export type SupplierInsert = Database['public']['Tables']['suppliers']['Insert']
export type ProductSupplierInsert = Database['public']['Tables']['product_suppliers']['Insert']
export type CartItemInsert = Database['public']['Tables']['cart_items']['Insert']
export type OrderInsert = Database['public']['Tables']['orders']['Insert']
export type UserProfileInsert = Database['public']['Tables']['user_profiles']['Insert']
export type BranchInsert = Database['public']['Tables']['branches']['Insert']
export type BranchInventoryInsert = Database['public']['Tables']['branch_inventory']['Insert']
export type CashSessionInsert = Database['public']['Tables']['cash_sessions']['Insert']
export type OrderPaymentInsert = Database['public']['Tables']['order_payments']['Insert']
export type AuditLogInsert = Database['public']['Tables']['audit_logs']['Insert']
export type InventoryMovementInsert = Database['public']['Tables']['inventory_movements']['Insert']
export type InventoryTransferInsert = Database['public']['Tables']['inventory_transfers']['Insert']

export type CategoryUpdate = Database['public']['Tables']['categories']['Update']
export type ProductUpdate = Database['public']['Tables']['products']['Update']
export type ProductVariantUpdate = Database['public']['Tables']['product_variants']['Update']
export type ProductImageUpdate = Database['public']['Tables']['product_images']['Update']
export type ProductBarcodeUpdate = Database['public']['Tables']['product_barcodes']['Update']
export type SupplierUpdate = Database['public']['Tables']['suppliers']['Update']
export type ProductSupplierUpdate = Database['public']['Tables']['product_suppliers']['Update']
export type CartItemUpdate = Database['public']['Tables']['cart_items']['Update']
export type OrderUpdate = Database['public']['Tables']['orders']['Update']
export type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update']
export type BranchUpdate = Database['public']['Tables']['branches']['Update']
export type BranchInventoryUpdate = Database['public']['Tables']['branch_inventory']['Update']
export type CashSessionUpdate = Database['public']['Tables']['cash_sessions']['Update']
export type OrderPaymentUpdate = Database['public']['Tables']['order_payments']['Update']
export type AuditLogUpdate = Database['public']['Tables']['audit_logs']['Update']
export type InventoryMovementUpdate = Database['public']['Tables']['inventory_movements']['Update']
export type InventoryTransferUpdate = Database['public']['Tables']['inventory_transfers']['Update']