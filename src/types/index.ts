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
  InventoryTransfer, InventoryTransferInsert, InventoryTransferUpdate
} from './database.types'

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
