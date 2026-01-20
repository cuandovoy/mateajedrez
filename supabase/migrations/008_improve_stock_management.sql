-- Improve stock management system
-- This migration adds functions to restore stock and better stock validation

-- Function to restore stock when order is cancelled
CREATE OR REPLACE FUNCTION restore_product_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Only restore stock if order status changed to cancelled
  -- and previous status was not cancelled
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    -- Restore stock for all items in the cancelled order
    UPDATE products
    SET stock = stock + (
      SELECT quantity
      FROM order_items
      WHERE order_items.order_id = NEW.id
      AND order_items.product_id = products.id
    )
    WHERE id IN (
      SELECT product_id
      FROM order_items
      WHERE order_id = NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to restore stock when order is cancelled
CREATE TRIGGER restore_stock_on_order_cancellation
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status != 'cancelled')
  EXECUTE FUNCTION restore_product_stock();

-- Function to check stock availability (can be called from application)
CREATE OR REPLACE FUNCTION check_stock_availability(
  product_id_param UUID,
  quantity_param INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  available_stock INTEGER;
BEGIN
  SELECT stock INTO available_stock
  FROM products
  WHERE id = product_id_param
  AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  RETURN available_stock >= quantity_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get available stock for multiple products
CREATE OR REPLACE FUNCTION get_products_stock(
  product_ids UUID[]
)
RETURNS TABLE (
  product_id UUID,
  available_stock INTEGER,
  is_available BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as product_id,
    p.stock as available_stock,
    (p.stock > 0 AND p.is_active = true) as is_available
  FROM products p
  WHERE p.id = ANY(product_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
