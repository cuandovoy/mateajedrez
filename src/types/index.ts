import { CartItem, Category, Product } from './database.types'

export type {
  CartItem, Category, CategoryInsert,
  CategoryUpdate, Database, Order,
  OrderItem, Product, ProductInsert,
  ProductUpdate, UserProfile
} from './database.types'

export interface CartItemWithProduct extends CartItem {
  product: Product
}

export interface ProductWithCategory extends Product {
  category: Category
}
