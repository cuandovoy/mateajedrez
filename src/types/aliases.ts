// Domain aliases over the generated types. Kept out of database.types.ts so regenerating it is a plain overwrite.
import type { Tables, TablesInsert, TablesUpdate } from './database.types'

export type AuditLog = Tables<'audit_logs'>
export type AuditLogInsert = TablesInsert<'audit_logs'>
export type AuditLogUpdate = TablesUpdate<'audit_logs'>

// The generator widens these CHECK-constrained text columns to `string`; narrowed here.
export type BranchKind = 'store' | 'warehouse' | 'seller'
export type Branch = Omit<Tables<'branches'>, 'kind'> & { kind: BranchKind }
export type BranchInsert = Omit<TablesInsert<'branches'>, 'kind'> & { kind?: BranchKind }
export type BranchUpdate = Omit<TablesUpdate<'branches'>, 'kind'> & { kind?: BranchKind }
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

export type InventoryLotStatus = 'active' | 'exhausted' | 'written_off'
export type InventoryLot = Omit<Tables<'inventory_lots'>, 'status'> & { status: InventoryLotStatus }
export type InventoryLotInsert = Omit<TablesInsert<'inventory_lots'>, 'status'> & { status?: InventoryLotStatus }
export type InventoryLotUpdate = Omit<TablesUpdate<'inventory_lots'>, 'status'> & { status?: InventoryLotStatus }

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
export type StoreCouponKind = 'fixed_amount' | 'percentage'
export type StoreCoupon = Omit<Tables<'store_coupons'>, 'kind'> & { kind: StoreCouponKind }
export type StoreCouponInsert = Omit<TablesInsert<'store_coupons'>, 'kind'> & { kind?: StoreCouponKind }
export type StoreCouponUpdate = Omit<TablesUpdate<'store_coupons'>, 'kind'> & { kind?: StoreCouponKind }
export type OrganizationSettings = {
  currency?: string | null
  locale?: string | null
  timezone?: string | null
  decimal_places?: number | null
  default_low_stock_threshold?: number | null
  transfer_contact_phone?: string | null
  transfer_contact_email?: string | null
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
  store_whatsapp_number?: string | null
  branches_enabled?: boolean | null
  transfers_enabled?: boolean | null
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
