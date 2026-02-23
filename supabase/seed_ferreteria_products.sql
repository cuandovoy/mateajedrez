-- Seed: 20 productos de ferretería
-- Ejecutar manualmente después de tener al menos una organización.
-- Crea la categoría "Ferretería" en la primera organización si no existe y luego inserta los productos.

DO $$
DECLARE
  v_org_id UUID;
  v_category_id UUID;
BEGIN
  SELECT id INTO v_org_id FROM organizations LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No hay organizaciones. Crea una organización antes de ejecutar este seed.';
  END IF;

  INSERT INTO categories (organization_id, name, description, slug, parent_id)
  VALUES (v_org_id, 'Ferretería', 'Herramientas, tornillería y artículos de ferretería', 'ferreteria', NULL)
  ON CONFLICT (organization_id, slug) DO NOTHING;

  SELECT id INTO v_category_id FROM categories WHERE organization_id = v_org_id AND slug = 'ferreteria' LIMIT 1;
  IF v_category_id IS NULL THEN
    SELECT id INTO v_category_id FROM categories WHERE organization_id = v_org_id LIMIT 1;
  END IF;
  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'No hay categorías para la organización.';
  END IF;

  INSERT INTO products (organization_id, name, description, price, stock, category_id, sku, is_active, unit, min_stock, low_stock_threshold)
  VALUES
    (v_org_id, 'Destornillador plano 6"', 'Destornillador de punta plana 6 pulgadas, mango ergonómico.', 890, 50, v_category_id, 'FER-DES-001', true, 'un', 5, 10),
    (v_org_id, 'Destornillador Phillips #2', 'Destornillador Phillips número 2, uso general.', 750, 60, v_category_id, 'FER-DES-002', true, 'un', 5, 10),
    (v_org_id, 'Martillo carpintero 16 oz', 'Martillo de carpintero 16 onzas, mango fibra de vidrio.', 2450, 30, v_category_id, 'FER-MAR-001', true, 'un', 3, 8),
    (v_org_id, 'Llave inglesa 10"', 'Llave inglesa ajustable 10 pulgadas, max 25mm.', 1890, 25, v_category_id, 'FER-LLA-001', true, 'un', 2, 6),
    (v_org_id, 'Tornillos tirafondo 4x50mm x 100 un', 'Tornillos tirafondo zincados 4x50mm, bolsa 100 unidades.', 1250, 80, v_category_id, 'FER-TOR-001', true, 'bolsa', 10, 20),
    (v_org_id, 'Clavos para construcción 2" x 1 kg', 'Clavos galvanizados 2 pulgadas, bolsa 1 kg.', 980, 100, v_category_id, 'FER-CLA-001', true, 'kg', 5, 15),
    (v_org_id, 'Cinta métrica 5m', 'Cinta métrica 5 metros, cierre automático.', 1650, 40, v_category_id, 'FER-CIN-001', true, 'un', 5, 10),
    (v_org_id, 'Nivel de burbuja 60cm', 'Nivel de burbuja aluminio 60 cm, 3 cámaras.', 3200, 20, v_category_id, 'FER-NIV-001', true, 'un', 2, 5),
    (v_org_id, 'Pinza universal 8"', 'Pinza universal 8 pulgadas, corte y sujeción.', 1420, 35, v_category_id, 'FER-PIN-001', true, 'un', 3, 8),
    (v_org_id, 'Taladro inalámbrico 12V', 'Taladro atornillador inalámbrico 12V con batería y cargador.', 18500, 12, v_category_id, 'FER-TAL-001', true, 'un', 1, 3),
    (v_org_id, 'Broca para metal 5mm x 5 un', 'Set 5 brocas HSS para metal 3-8mm.', 2100, 45, v_category_id, 'FER-BRO-001', true, 'set', 5, 12),
    (v_org_id, 'Cable eléctrico 2,5mm² x 50m', 'Cable unipolar 2,5 mm² color negro, rollo 50m.', 8500, 25, v_category_id, 'FER-CAB-001', true, 'rollo', 2, 5),
    (v_org_id, 'Caja de paso 10x15cm', 'Caja de derivación plástico 10x15cm, tapa abatible.', 450, 60, v_category_id, 'FER-CAJ-001', true, 'un', 10, 20),
    (v_org_id, 'Cinta aisladora 19mm x 20m', 'Cinta aisladora negra 19mm ancho, rollo 20m.', 680, 70, v_category_id, 'FER-AIS-001', true, 'rollo', 10, 25),
    (v_org_id, 'Pintura látex blanca 4L', 'Pintura látex lavable blanco, cubritura 40m²/L, 4 litros.', 4200, 30, v_category_id, 'FER-PIN-002', true, 'l', 3, 8),
    (v_org_id, 'Rodillo lana 9"', 'Rodillo para pintar lana 9 pulgadas, mango incluido.', 1250, 40, v_category_id, 'FER-ROD-001', true, 'un', 5, 12),
    (v_org_id, 'Escuadra metálica 30cm', 'Escuadra de acero 30cm para marcado y verificación.', 890, 35, v_category_id, 'FER-ESC-001', true, 'un', 5, 10),
    (v_org_id, 'Sierra de mano 22"', 'Sierra de mano 22 pulgadas, dientes universales.', 2100, 18, v_category_id, 'FER-SIE-001', true, 'un', 2, 5),
    (v_org_id, 'Lija grano 120 x 5 hojas', 'Lija al agua grano 120, pack 5 hojas 23x28cm.', 650, 55, v_category_id, 'FER-LIJ-001', true, 'pack', 10, 20),
    (v_org_id, 'Adhesivo contacto 1L', 'Adhesivo de contacto para madera y revestimientos, 1 litro.', 3200, 22, v_category_id, 'FER-ADH-001', true, 'l', 2, 6);

END $$;
