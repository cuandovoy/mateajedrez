import { CartItem, Category, Product, ProductVariant } from './database.types'

export type {
  CartItem, Category, CategoryInsert,
  CategoryUpdate, Database, Order,
  OrderItem, Product, ProductInsert,
  ProductUpdate, ProductVariant, ProductVariantInsert,
  ProductVariantUpdate, ProductImage, ProductImageInsert,
  ProductImageUpdate, ProductBarcode, ProductBarcodeInsert,
  ProductBarcodeUpdate, Supplier, SupplierInsert, SupplierUpdate,
  ProductSupplier, ProductSupplierInsert, ProductSupplierUpdate,
  UserProfile, Branch, BranchInsert, BranchUpdate,
  CashSession, CashSessionInsert, CashSessionUpdate,
  OrderPayment, OrderPaymentInsert, OrderPaymentUpdate,
  AuditLog, AuditLogInsert, AuditLogUpdate,
  InventoryMovement, InventoryMovementInsert, InventoryMovementUpdate,
  InventoryTransfer, InventoryTransferInsert, InventoryTransferUpdate,
  OrganizationMember, StoreCoupon, StoreCouponInsert, StoreCouponUpdate,
} from './database.types'

/**
 * Extended organization member with org-role fields that migration 089 added.
 * The generated database.types.ts does not yet include organization_role_id,
 * so we extend here until types are regenerated.
 */
export interface OrganizationMemberExtended {
  id: string
  user_id: string
  organization_id: string
  role: string
  organization_role_id: string | null
  base_role_key?: string | null
  joined_at?: string | null
  invited_by?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface CartItemWithProduct extends CartItem {
  product: Product
  variant?: ProductVariant | null
}

export interface ProductWithCategory extends Product {
  category: Category
}

export interface ProductVariantWithProduct extends ProductVariant {
  product: Product
}

export interface ProductMovementRow {
  id: string
  branch_id: string
  branch_name: string
  movement_type: string
  quantity: number
  previous_stock: number
  new_stock: number
  reference_type: string | null
  reference_id: string | null
  notes: string | null
  created_at: string
  total_count: number
}

export interface PurchaseOrderItemRow {
  id: string
  purchase_order_id: string
  product_id: string
  variant_id: string | null
  quantity_ordered: number
  quantity_received: number
  unit_cost: number
  line_number: number
}
