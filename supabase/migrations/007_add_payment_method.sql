-- Add payment_method field to orders table
-- This migration adds support for different payment methods

-- Create payment method enum
CREATE TYPE payment_method AS ENUM ('transfer', 'mercadopago');

-- Add payment_method column to orders table
ALTER TABLE orders
  ADD COLUMN payment_method payment_method DEFAULT 'transfer';

-- Create function to decrement product stock when order is created
CREATE OR REPLACE FUNCTION decrement_product_stock()
RETURNS TRIGGER AS $$
DECLARE
  current_stock INTEGER;
  product_name VARCHAR;
BEGIN
  -- Get current stock and product name
  SELECT stock, name INTO current_stock, product_name
  FROM products
  WHERE id = NEW.product_id;
  
  -- Check if product exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product % not found', NEW.product_id;
  END IF;
  
  -- Check if there's enough stock
  IF current_stock < NEW.quantity THEN
    RAISE EXCEPTION 'Insufficient stock for product "%". Available: %, Requested: %', 
      product_name, current_stock, NEW.quantity;
  END IF;
  
  -- Decrement stock
  UPDATE products
  SET stock = stock - NEW.quantity
  WHERE id = NEW.product_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to decrement stock when order items are inserted
CREATE TRIGGER decrement_stock_on_order_item
  AFTER INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION decrement_product_stock();
