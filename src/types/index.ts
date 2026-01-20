export type {
  Database,
  Category,
  Product,
  CartItem,
  Order,
  OrderItem,
  UserProfile,
  CategoryInsert,
  CategoryUpdate,
  ProductInsert,
  ProductUpdate,
} from './database.types'

export interface CartItemWithProduct extends CartItem {
  product: Product
}

export interface ProductWithCategory extends Product {
  category: Category
}
