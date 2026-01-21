# 📊 Estructura de Códigos de Barras

> **Nota**: Este sistema utiliza exclusivamente el estándar **EAN-13** para códigos de barras, con generación automática disponible.

## 📋 Diferencia entre SKU y Código de Barras

### SKU (Stock Keeping Unit)
- **Propósito**: Identificador interno único del producto/variante
- **Formato**: Alfanumérico, personalizado (ej: "PROD-001", "REMERA-ROJA-M")
- **Uso**: Gestión interna, inventario, referencias internas
- **Características**:
  - Único por producto/variante
  - Puede ser corto y descriptivo
  - No necesariamente escaneable

### Código de Barras
- **Propósito**: Identificador estándar para escaneo y venta
- **Formato**: Numérico o alfanumérico según el tipo (EAN-13: 13 dígitos)
- **Uso**: Punto de venta, escaneo, integración con sistemas externos
- **Características**:
  - Puede haber múltiples códigos por producto/variante
  - Sigue estándares internacionales (EAN, UPC, etc.)
  - Escaneable con lectores de código de barras

## 🏗️ Estructura Implementada

### Tabla `product_barcodes`

```sql
CREATE TABLE product_barcodes (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES products(id),  -- NULL si es de variante
  variant_id UUID REFERENCES product_variants(id),  -- NULL si es de producto
  barcode VARCHAR(255) NOT NULL UNIQUE,
  barcode_type barcode_type NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Tipo de Código de Barras Utilizado

**EAN-13** - European Article Number (13 dígitos)
- Estándar internacional más común
- Formato: 13 dígitos numéricos
- Ejemplo: `7791234567890`
- Prefijo por defecto: `779` (Argentina)
- Incluye dígito de control calculado automáticamente

### Generación Automática

El sistema puede generar códigos EAN-13 automáticamente con:
- Prefijo de país/empresa: `779` (configurable)
- 9 dígitos aleatorios únicos
- Dígito de control calculado según algoritmo EAN-13
- Validación de unicidad en la base de datos

## 🎯 Casos de Uso

### Escenario 1: Producto Simple
- **SKU**: `COLLAR-MALVA-001`
- **Código de Barras Principal**: `7791234567890` (EAN-13)
- **Código de Barras Alternativo**: `SUPPLIER-ABC123` (SUPPLIER)

### Escenario 2: Producto con Variantes
- **Producto SKU**: `REMERA-BASICA`
- **Variante 1 SKU**: `REMERA-BASICA-ROJA-M`
  - Código de Barras: `7791234567891` (EAN-13)
- **Variante 2 SKU**: `REMERA-BASICA-ROJA-L`
  - Código de Barras: `7791234567892` (EAN-13)

### Escenario 3: Múltiples Códigos
Un producto puede tener:
- Código EAN-13 principal (para venta)
- Código UPC (para mercado norteamericano)
- Código interno (para gestión de almacén)
- Código de proveedor (para pedidos)

## ✅ Ventajas de esta Estructura

1. **Escalable**: Permite múltiples códigos por producto/variante
2. **Flexible**: Soporta diferentes tipos de códigos
3. **Estándar**: Sigue convenciones internacionales
4. **Validación**: Valida formato según tipo
5. **Principal**: Permite marcar un código como principal
6. **Notas**: Permite agregar información adicional

## 🔧 Uso en el Sistema

### En AdminProducts
- Agregar gestión de códigos de barras en el formulario de producto
- Mostrar código de barras principal en la tabla
- Permitir escanear códigos de barras para buscar productos

### En Punto de Venta
- Escanear código de barras para agregar al carrito
- Buscar productos por código de barras
- Validar códigos al escanear

### En Inventario
- Escanear códigos para actualizar stock
- Validar códigos al recibir mercadería
- Generar códigos de barras automáticamente
