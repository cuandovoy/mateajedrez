-- ============================================================
-- Seed: Órdenes de venta de prueba (demo / video)
-- Organización: e3573e1c-0383-4bde-9f4a-07b122ecf5cc
-- ============================================================
-- Decisiones tomadas:
--   - branch_id = NULL en todas las órdenes: no impacta branch_inventory
--     ni products.stock (varios productos ya están en 0 unidades:
--     Zapatilla running, Aceite).
--   - Los totales (total / subtotal_before_discount / discount_total /
--     tax_total) no se cargan a mano: los recalcula el trigger
--     trg_recalculate_order_totals_from_items al insertar order_items.
--   - order_number no se setea: lo asigna el trigger de forma
--     secuencial por organización.
--   - base_unit_price / cost_at_sale / margin_* / cost_source de
--     order_items no se cargan: los completan los triggers de las
--     migraciones 069 / 082 / 124.
--   - 2 órdenes vinculadas a Pepe, 4 a Lucas Ciceri, resto guest
--     (customer_id NULL) para simular checkout online sin cuenta.
--
-- Ejecutar manualmente en el SQL Editor de Supabase.
-- ============================================================

-- Orden 1 — Pepe, venta manual (mostrador), cash, delivered
DO $$
DECLARE
  v_order_id uuid;
BEGIN
  INSERT INTO orders (organization_id, customer_id, branch_id, status, source, shipping_address, payment_method, created_at, updated_at, total)
  VALUES (
    'e3573e1c-0383-4bde-9f4a-07b122ecf5cc',
    '45bb606d-4588-4208-9d94-714837edf3ea',
    NULL, 'delivered', 'manual',
    jsonb_build_object('fullName', 'Pepe', 'email', 'lucasciceri59@gmail.com', 'phone', '09123123123',
      'rut', '', 'taxId', '', 'address', 'Venta en tienda física', 'city', '', 'state', '', 'zipCode', '', 'country', ''),
    'cash', '2026-05-22 10:15:00-03', '2026-05-22 10:15:00-03'
    , 0.00
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, product_id, quantity, price, created_at) VALUES
    (v_order_id, '7df29804-b95e-4f60-b225-a1df6d16e919', 1, 18500.00, '2026-05-22 10:15:00-03'),
    (v_order_id, '50c73a41-c1fa-4398-ab18-656eefba8189', 2, 2100.00, '2026-05-22 10:15:00-03');
END $$;

-- Orden 2 — guest María Fernández, tienda online, mercadopago, delivered
DO $$
DECLARE
  v_order_id uuid;
BEGIN
  INSERT INTO orders (organization_id, customer_id, branch_id, status, source, shipping_address, payment_method, created_at, updated_at, total)
  VALUES (
    'e3573e1c-0383-4bde-9f4a-07b122ecf5cc',
    NULL, NULL, 'delivered', 'store',
    jsonb_build_object('fullName', 'María Fernández', 'email', 'maria.fernandez@gmail.com', 'phone', '098111222'),
    'mercadopago', '2026-05-25 16:40:00-03', '2026-05-25 16:40:00-03'
    , 0.00
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, product_id, quantity, price, created_at) VALUES
    (v_order_id, '5c1e1a05-2ae1-43ed-90de-0196e43ebab1', 1, 1650.00, '2026-05-25 16:40:00-03'),
    (v_order_id, 'f66cc68a-b753-4a16-99a7-85850aa831d1', 1, 3200.00, '2026-05-25 16:40:00-03');
END $$;

-- Orden 3 — Lucas Ciceri, venta manual, transfer, delivered
DO $$
DECLARE
  v_order_id uuid;
BEGIN
  INSERT INTO orders (organization_id, customer_id, branch_id, status, source, shipping_address, payment_method, created_at, updated_at, total)
  VALUES (
    'e3573e1c-0383-4bde-9f4a-07b122ecf5cc',
    'a617da51-98e6-4611-ac4b-fd11182b549e',
    NULL, 'delivered', 'manual',
    jsonb_build_object('fullName', 'Lucas Ciceri', 'email', 'lucasciceri59@gmail.com', 'phone', '091690509',
      'rut', '', 'taxId', '', 'address', 'Venta en tienda física', 'city', '', 'state', '', 'zipCode', '', 'country', ''),
    'transfer', '2026-05-29 11:05:00-03', '2026-05-29 11:05:00-03'
    , 0.00
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, product_id, quantity, price, created_at) VALUES
    (v_order_id, 'c774b297-d294-45e4-a866-f6531ff39a1c', 2, 3200.00, '2026-05-29 11:05:00-03'),
    (v_order_id, '610b37d5-6feb-45d5-9c21-06e01d2e1391', 3, 650.00, '2026-05-29 11:05:00-03');
END $$;

-- Orden 4 — guest Carlos Rodríguez, tienda online, mercadopago, delivered
DO $$
DECLARE
  v_order_id uuid;
BEGIN
  INSERT INTO orders (organization_id, customer_id, branch_id, status, source, shipping_address, payment_method, created_at, updated_at, total)
  VALUES (
    'e3573e1c-0383-4bde-9f4a-07b122ecf5cc',
    NULL, NULL, 'delivered', 'store',
    jsonb_build_object('fullName', 'Carlos Rodríguez', 'email', 'carlos.rodriguez@hotmail.com', 'phone', '099222333'),
    'mercadopago', '2026-06-02 19:20:00-03', '2026-06-02 19:20:00-03'
    , 0.00
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, product_id, quantity, price, created_at) VALUES
    (v_order_id, '9924c67a-921a-48ba-8213-bef2e58fb86e', 2, 1500.00, '2026-06-02 19:20:00-03'),
    (v_order_id, '9db8d492-e35b-45d8-8308-5667d95c3fd3', 1, 2500.00, '2026-06-02 19:20:00-03');
END $$;

-- Orden 5 — Pepe, venta manual, cash, delivered
DO $$
DECLARE
  v_order_id uuid;
BEGIN
  INSERT INTO orders (organization_id, customer_id, branch_id, status, source, shipping_address, payment_method, created_at, updated_at, total)
  VALUES (
    'e3573e1c-0383-4bde-9f4a-07b122ecf5cc',
    '45bb606d-4588-4208-9d94-714837edf3ea',
    NULL, 'delivered', 'manual',
    jsonb_build_object('fullName', 'Pepe', 'email', 'lucasciceri59@gmail.com', 'phone', '09123123123',
      'rut', '', 'taxId', '', 'address', 'Venta en tienda física', 'city', '', 'state', '', 'zipCode', '', 'country', ''),
    'cash', '2026-06-04 09:50:00-03', '2026-06-04 09:50:00-03'
    , 0.00
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, product_id, quantity, price, created_at) VALUES
    (v_order_id, 'a0a23ffe-8e53-49d0-b914-9f61bcc9f23a', 1, 2450.00, '2026-06-04 09:50:00-03'),
    (v_order_id, 'e6660a45-2290-4ac9-8adf-3122b81c0281', 3, 890.00, '2026-06-04 09:50:00-03'),
    (v_order_id, '1c45044c-4dc1-4efd-b6a5-b093f9084979', 1, 1420.00, '2026-06-04 09:50:00-03');
END $$;

-- Orden 6 — guest Ana Silva, tienda online, mercadopago, pending
DO $$
DECLARE
  v_order_id uuid;
BEGIN
  INSERT INTO orders (organization_id, customer_id, branch_id, status, source, shipping_address, payment_method, created_at, updated_at, total)
  VALUES (
    'e3573e1c-0383-4bde-9f4a-07b122ecf5cc',
    NULL, NULL, 'pending', 'store',
    jsonb_build_object('fullName', 'Ana Silva', 'email', 'ana.silva@gmail.com', 'phone', '098333444'),
    'mercadopago', '2026-06-07 21:10:00-03', '2026-06-07 21:10:00-03'
    , 0.00
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, product_id, quantity, price, created_at) VALUES
    (v_order_id, 'c24b4f8c-02cf-4536-b04f-213383e83ec2', 1, 3800.00, '2026-06-07 21:10:00-03');
END $$;

-- Orden 7 — Lucas Ciceri, venta manual, cash, delivered
DO $$
DECLARE
  v_order_id uuid;
BEGIN
  INSERT INTO orders (organization_id, customer_id, branch_id, status, source, shipping_address, payment_method, created_at, updated_at, total)
  VALUES (
    'e3573e1c-0383-4bde-9f4a-07b122ecf5cc',
    'a617da51-98e6-4611-ac4b-fd11182b549e',
    NULL, 'delivered', 'manual',
    jsonb_build_object('fullName', 'Lucas Ciceri', 'email', 'lucasciceri59@gmail.com', 'phone', '091690509',
      'rut', '', 'taxId', '', 'address', 'Venta en tienda física', 'city', '', 'state', '', 'zipCode', '', 'country', ''),
    'cash', '2026-06-09 15:30:00-03', '2026-06-09 15:30:00-03'
    , 0.00
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, product_id, quantity, price, created_at) VALUES
    (v_order_id, 'c8f8a10c-3f61-4997-89bb-4136795c2aca', 1, 8500.00, '2026-06-09 15:30:00-03'),
    (v_order_id, '66f0e26d-74c4-44f1-91c4-f9a7114902d4', 2, 450.00, '2026-06-09 15:30:00-03');
END $$;

-- Orden 8 — guest Diego Pérez, tienda online, transfer, shipped
DO $$
DECLARE
  v_order_id uuid;
BEGIN
  INSERT INTO orders (organization_id, customer_id, branch_id, status, source, shipping_address, payment_method, created_at, updated_at, total)
  VALUES (
    'e3573e1c-0383-4bde-9f4a-07b122ecf5cc',
    NULL, NULL, 'shipped', 'store',
    jsonb_build_object('fullName', 'Diego Pérez', 'email', 'diego.perez@gmail.com', 'phone', '099444555'),
    'transfer', '2026-06-11 12:00:00-03', '2026-06-11 12:00:00-03'
    , 0.00
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, product_id, quantity, price, created_at) VALUES
    (v_order_id, '6a1676c1-b4ae-426f-87ed-02f13cc2e2b2', 5, 100.00, '2026-06-11 12:00:00-03'),
    (v_order_id, 'd16c5f90-4e22-4db3-9e2c-a74b318d427a', 3, 500.00, '2026-06-11 12:00:00-03');
END $$;

-- Orden 9 — Pepe, venta manual, cash, delivered
DO $$
DECLARE
  v_order_id uuid;
BEGIN
  INSERT INTO orders (organization_id, customer_id, branch_id, status, source, shipping_address, payment_method, created_at, updated_at, total)
  VALUES (
    'e3573e1c-0383-4bde-9f4a-07b122ecf5cc',
    '45bb606d-4588-4208-9d94-714837edf3ea',
    NULL, 'delivered', 'manual',
    jsonb_build_object('fullName', 'Pepe', 'email', 'lucasciceri59@gmail.com', 'phone', '09123123123',
      'rut', '', 'taxId', '', 'address', 'Venta en tienda física', 'city', '', 'state', '', 'zipCode', '', 'country', ''),
    'cash', '2026-06-13 10:45:00-03', '2026-06-13 10:45:00-03'
    , 0.00
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, product_id, quantity, price, created_at) VALUES
    (v_order_id, '20c46cee-e044-4f95-9359-f8cf805392c1', 1, 2100.00, '2026-06-13 10:45:00-03'),
    (v_order_id, 'd2cb1a6a-5546-41ed-8048-db52baefc70c', 2, 890.00, '2026-06-13 10:45:00-03');
END $$;

-- Orden 10 — guest Valentina López, tienda online, mercadopago, delivered
DO $$
DECLARE
  v_order_id uuid;
BEGIN
  INSERT INTO orders (organization_id, customer_id, branch_id, status, source, shipping_address, payment_method, created_at, updated_at, total)
  VALUES (
    'e3573e1c-0383-4bde-9f4a-07b122ecf5cc',
    NULL, NULL, 'delivered', 'store',
    jsonb_build_object('fullName', 'Valentina López', 'email', 'valentina.lopez@gmail.com', 'phone', '098555666'),
    'mercadopago', '2026-06-16 17:15:00-03', '2026-06-16 17:15:00-03'
    , 0.00
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, product_id, quantity, price, created_at) VALUES
    (v_order_id, '2e335190-d1ff-4bd1-bc67-fbe84e842aa0', 1, 4200.00, '2026-06-16 17:15:00-03'),
    (v_order_id, '316b3e5d-5360-4a72-996c-46abdc1f09b0', 1, 1250.00, '2026-06-16 17:15:00-03');
END $$;

-- Orden 11 — Lucas Ciceri, compra online, mercadopago, delivered
DO $$
DECLARE
  v_order_id uuid;
BEGIN
  INSERT INTO orders (organization_id, customer_id, branch_id, status, source, shipping_address, payment_method, created_at, updated_at, total)
  VALUES (
    'e3573e1c-0383-4bde-9f4a-07b122ecf5cc',
    'a617da51-98e6-4611-ac4b-fd11182b549e',
    NULL, 'delivered', 'store',
    jsonb_build_object('fullName', 'Lucas Ciceri', 'email', 'lucasciceri59@gmail.com', 'phone', '091690509'),
    'mercadopago', '2026-06-18 13:25:00-03', '2026-06-18 13:25:00-03'
    , 0.00
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, product_id, quantity, price, created_at) VALUES
    (v_order_id, '3170b095-12eb-41da-87ab-b622aa455ada', 1, 500.00, '2026-06-18 13:25:00-03'),
    (v_order_id, '4bb56d67-46f9-48b8-93ae-6240377eddf8', 1, 4500.00, '2026-06-18 13:25:00-03');
END $$;

-- Orden 12 — Consumidor final (mostrador, sin cliente), manual, cash, delivered
DO $$
DECLARE
  v_order_id uuid;
BEGIN
  INSERT INTO orders (organization_id, customer_id, branch_id, status, source, shipping_address, payment_method, created_at, updated_at, total)
  VALUES (
    'e3573e1c-0383-4bde-9f4a-07b122ecf5cc',
    NULL, NULL, 'delivered', 'manual',
    jsonb_build_object('fullName', 'Consumidor Final', 'email', '', 'phone', '',
      'rut', '', 'taxId', '', 'address', 'Venta en tienda física', 'city', '', 'state', '', 'zipCode', '', 'country', ''),
    'cash', '2026-06-20 11:40:00-03', '2026-06-20 11:40:00-03'
    , 0.00
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, product_id, quantity, price, created_at) VALUES
    (v_order_id, '54c71206-8243-4b0e-9b82-c7edfacf87b1', 4, 680.00, '2026-06-20 11:40:00-03');
END $$;

-- Orden 13 — Pepe, venta manual, cash, cancelled
DO $$
DECLARE
  v_order_id uuid;
BEGIN
  INSERT INTO orders (organization_id, customer_id, branch_id, status, source, shipping_address, payment_method, created_at, updated_at, total)
  VALUES (
    'e3573e1c-0383-4bde-9f4a-07b122ecf5cc',
    '45bb606d-4588-4208-9d94-714837edf3ea',
    NULL, 'cancelled', 'manual',
    jsonb_build_object('fullName', 'Pepe', 'email', 'lucasciceri59@gmail.com', 'phone', '09123123123',
      'rut', '', 'taxId', '', 'address', 'Venta en tienda física', 'city', '', 'state', '', 'zipCode', '', 'country', ''),
    'cash', '2026-06-23 14:05:00-03', '2026-06-23 14:05:00-03'
    , 0.00
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, product_id, quantity, price, created_at) VALUES
    (v_order_id, '7df29804-b95e-4f60-b225-a1df6d16e919', 1, 18500.00, '2026-06-23 14:05:00-03');
END $$;

-- Orden 14 — guest Rosana Methol, tienda online, mercadopago, delivered
DO $$
DECLARE
  v_order_id uuid;
BEGIN
  INSERT INTO orders (organization_id, customer_id, branch_id, status, source, shipping_address, payment_method, created_at, updated_at, total)
  VALUES (
    'e3573e1c-0383-4bde-9f4a-07b122ecf5cc',
    NULL, NULL, 'delivered', 'store',
    jsonb_build_object('fullName', 'Rosana Methol', 'email', 'rosana.methol@gmail.com', 'phone', '099666777'),
    'mercadopago', '2026-06-25 20:30:00-03', '2026-06-25 20:30:00-03'
    , 0.00
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, product_id, quantity, price, created_at) VALUES
    (v_order_id, 'a0895c6d-9fd9-4b8c-a200-26b20d51ef6c', 10, 50.00, '2026-06-25 20:30:00-03'),
    (v_order_id, '752531b5-d27c-4d8f-9919-ff34e2041cd6', 2, 1250.00, '2026-06-25 20:30:00-03');
END $$;

-- Orden 15 — Lucas Ciceri, venta manual, transfer, delivered
DO $$
DECLARE
  v_order_id uuid;
BEGIN
  INSERT INTO orders (organization_id, customer_id, branch_id, status, source, shipping_address, payment_method, created_at, updated_at, total)
  VALUES (
    'e3573e1c-0383-4bde-9f4a-07b122ecf5cc',
    'a617da51-98e6-4611-ac4b-fd11182b549e',
    NULL, 'delivered', 'manual',
    jsonb_build_object('fullName', 'Lucas Ciceri', 'email', 'lucasciceri59@gmail.com', 'phone', '091690509',
      'rut', '', 'taxId', '', 'address', 'Venta en tienda física', 'city', '', 'state', '', 'zipCode', '', 'country', ''),
    'transfer', '2026-06-28 09:15:00-03', '2026-06-28 09:15:00-03'
    , 0.00
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, product_id, quantity, price, created_at) VALUES
    (v_order_id, '17512679-2046-498b-9ba6-4ccc70ad466e', 3, 980.00, '2026-06-28 09:15:00-03'),
    (v_order_id, '50c73a41-c1fa-4398-ab18-656eefba8189', 1, 2100.00, '2026-06-28 09:15:00-03');
END $$;

-- Orden 16 — guest Nicolás Vidal, tienda online, mercadopago, processing
DO $$
DECLARE
  v_order_id uuid;
BEGIN
  INSERT INTO orders (organization_id, customer_id, branch_id, status, source, shipping_address, payment_method, created_at, updated_at, total)
  VALUES (
    'e3573e1c-0383-4bde-9f4a-07b122ecf5cc',
    NULL, NULL, 'processing', 'store',
    jsonb_build_object('fullName', 'Nicolás Vidal', 'email', 'nicolas.vidal@gmail.com', 'phone', '098777888'),
    'mercadopago', '2026-06-30 18:50:00-03', '2026-06-30 18:50:00-03'
    , 0.00
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, product_id, quantity, price, created_at) VALUES
    (v_order_id, '9924c67a-921a-48ba-8213-bef2e58fb86e', 1, 1500.00, '2026-06-30 18:50:00-03'),
    (v_order_id, 'c24b4f8c-02cf-4536-b04f-213383e83ec2', 1, 3800.00, '2026-06-30 18:50:00-03');
END $$;

-- Orden 17 — Pepe, venta manual, cash, delivered
DO $$
DECLARE
  v_order_id uuid;
BEGIN
  INSERT INTO orders (organization_id, customer_id, branch_id, status, source, shipping_address, payment_method, created_at, updated_at, total)
  VALUES (
    'e3573e1c-0383-4bde-9f4a-07b122ecf5cc',
    '45bb606d-4588-4208-9d94-714837edf3ea',
    NULL, 'delivered', 'manual',
    jsonb_build_object('fullName', 'Pepe', 'email', 'lucasciceri59@gmail.com', 'phone', '09123123123',
      'rut', '', 'taxId', '', 'address', 'Venta en tienda física', 'city', '', 'state', '', 'zipCode', '', 'country', ''),
    'cash', '2026-07-02 10:10:00-03', '2026-07-02 10:10:00-03'
    , 0.00
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, product_id, quantity, price, created_at) VALUES
    (v_order_id, '87d250e9-6db3-4a63-9c1c-da897c5e6a90', 2, 1890.00, '2026-07-02 10:10:00-03'),
    (v_order_id, '5ba4a414-5046-4611-9a2e-fb188e44d1c6', 2, 750.00, '2026-07-02 10:10:00-03');
END $$;

-- Orden 18 — guest Lucía Castro, tienda online, mercadopago, delivered
DO $$
DECLARE
  v_order_id uuid;
BEGIN
  INSERT INTO orders (organization_id, customer_id, branch_id, status, source, shipping_address, payment_method, created_at, updated_at, total)
  VALUES (
    'e3573e1c-0383-4bde-9f4a-07b122ecf5cc',
    NULL, NULL, 'delivered', 'store',
    jsonb_build_object('fullName', 'Lucía Castro', 'email', 'lucia.castro@gmail.com', 'phone', '099888999'),
    'mercadopago', '2026-07-04 16:00:00-03', '2026-07-04 16:00:00-03'
    , 0.00
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, product_id, quantity, price, created_at) VALUES
    (v_order_id, '9db8d492-e35b-45d8-8308-5667d95c3fd3', 2, 2500.00, '2026-07-04 16:00:00-03'),
    (v_order_id, 'd16c5f90-4e22-4db3-9e2c-a74b318d427a', 1, 500.00, '2026-07-04 16:00:00-03');
END $$;

-- ============================================================
-- Verificación rápida (opcional, correr después de los inserts)
-- ============================================================
-- select count(*) as ordenes, sum(total) as facturado
-- from orders where organization_id = 'e3573e1c-0383-4bde-9f4a-07b122ecf5cc';
--
-- select o.id, o.order_number, o.status, o.source, o.total, c.full_name
-- from orders o
-- left join customers c on c.id = o.customer_id
-- where o.organization_id = 'e3573e1c-0383-4bde-9f4a-07b122ecf5cc'
-- order by o.created_at;
