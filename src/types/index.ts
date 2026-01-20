import { CartItem, Category, Product, ProductVariant } from './database.types'

export type {
  CartItem, Category, CategoryInsert,
  CategoryUpdate, Database, Order,
  OrderItem, Product, ProductInsert,
  ProductUpdate, ProductVariant, ProductVariantInsert,
  ProductVariantUpdate, ProductImage, ProductImageInsert,
  ProductImageUpdate, UserProfile
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
