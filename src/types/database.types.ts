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
          user_id: string
          total: number
          status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
          shipping_address: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          total: number
          status?: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
          shipping_address: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          total?: number
          status?: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
          shipping_address?: Json
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
          user_id: string
          role: 'user' | 'admin'
          full_name: string | null
          phone: string | null
          address: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role?: 'user' | 'admin'
          full_name?: string | null
          phone?: string | null
          address?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: 'user' | 'admin'
          full_name?: string | null
          phone?: string | null
          address?: Json | null
          created_at?: string
          updated_at?: string
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
    }
  }
}

// Type helpers
export type Category = Database['public']['Tables']['categories']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type ProductVariant = Database['public']['Tables']['product_variants']['Row']
export type ProductImage = Database['public']['Tables']['product_images']['Row']
export type CartItem = Database['public']['Tables']['cart_items']['Row']
export type Order = Database['public']['Tables']['orders']['Row']
export type OrderItem = Database['public']['Tables']['order_items']['Row']
export type UserProfile = Database['public']['Tables']['user_profiles']['Row']

export type CategoryInsert = Database['public']['Tables']['categories']['Insert']
export type ProductInsert = Database['public']['Tables']['products']['Insert']
export type ProductVariantInsert = Database['public']['Tables']['product_variants']['Insert']
export type ProductImageInsert = Database['public']['Tables']['product_images']['Insert']
export type CartItemInsert = Database['public']['Tables']['cart_items']['Insert']
export type OrderInsert = Database['public']['Tables']['orders']['Insert']
export type UserProfileInsert = Database['public']['Tables']['user_profiles']['Insert']

export type CategoryUpdate = Database['public']['Tables']['categories']['Update']
export type ProductUpdate = Database['public']['Tables']['products']['Update']
export type ProductVariantUpdate = Database['public']['Tables']['product_variants']['Update']
export type ProductImageUpdate = Database['public']['Tables']['product_images']['Update']
export type CartItemUpdate = Database['public']['Tables']['cart_items']['Update']
export type OrderUpdate = Database['public']['Tables']['orders']['Update']
export type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update']
