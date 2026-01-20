# Reglas de Desarrollo - Ecommerce App

Este documento establece las reglas y convenciones que deben seguirse en todo el desarrollo de la aplicación.

## 🎨 Estilos y UI

### Tailwind CSS - OBLIGATORIO

- **SIEMPRE usar Tailwind CSS** para todos los estilos. No usar CSS modules, styled-components, ni archivos CSS externos.
- Usar clases de utilidad de Tailwind en lugar de estilos inline cuando sea posible.
- Para estilos dinámicos, usar `clsx` o template literals con clases de Tailwind.
- Seguir la paleta de colores definida en `tailwind.config.js`.

### Componentes UI

- Todos los componentes deben ser responsive por defecto.
- Usar las clases de spacing de Tailwind (p-4, m-2, gap-4, etc.).
- Mantener consistencia en los tamaños de fuente y espaciado.

## 📁 Estructura de Carpetas

```
src/
├── components/          # Componentes reutilizables
│   ├── ui/             # Componentes UI básicos (Button, Input, etc.)
│   ├── layout/         # Componentes de layout (Header, Footer, etc.)
│   └── features/       # Componentes específicos de features
├── pages/              # Páginas de la aplicación
├── hooks/              # Custom hooks
├── store/              # Estado global (Zustand)
├── lib/                # Utilidades y configuraciones
│   ├── supabase.ts    # Cliente de Supabase
│   └── utils.ts       # Funciones utilitarias
├── types/              # Definiciones de tipos TypeScript
└── routes/             # Configuración de rutas
```

## 🔧 TypeScript

- **SIEMPRE usar TypeScript** para todos los archivos.
- Definir tipos explícitos para props de componentes.
- Usar interfaces para objetos y types para uniones.
- Evitar `any`. Usar `unknown` si es necesario.
- Exportar tipos desde `types/` cuando se reutilicen.

## 🎯 Componentes React

### Convenciones de Nombres

- Componentes: PascalCase (ej: `ProductCard.tsx`)
- Hooks: camelCase con prefijo `use` (ej: `useAuth.ts`)
- Utilidades: camelCase (ej: `formatPrice.ts`)
- Constantes: UPPER_SNAKE_CASE (ej: `MAX_CART_ITEMS`)

### Estructura de Componentes

```typescript
// 1. Imports
import { useState } from 'react'
import { Button } from '@/components/ui/Button'

// 2. Types/Interfaces
interface ProductCardProps {
  product: Product
  onAddToCart: (product: Product) => void
}

// 3. Componente
export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  // 4. Hooks
  const [isLoading, setIsLoading] = useState(false)

  // 5. Handlers
  const handleClick = () => {
    onAddToCart(product)
  }

  // 6. Render
  return (
    <div className="...">
      {/* JSX */}
    </div>
  )
}
```

## 🗄️ Estado Global

- Usar **Zustand** para estado global.
- Crear stores separados por dominio (auth, cart, products).
- Mantener stores simples y enfocados.

## 🔐 Autenticación y Roles

- Usar Supabase Auth para autenticación.
- Verificar roles en el cliente y servidor (RLS policies).
- Proteger rutas admin con componentes `ProtectedRoute`.

## 📊 Base de Datos

- Todas las tablas deben tener `created_at` y `updated_at`.
- Usar UUIDs para IDs primarios.
- Implementar Row Level Security (RLS) en todas las tablas.
- Usar migraciones para todos los cambios de esquema.

## 🧪 Validación

- Usar **Zod** para validación de formularios.
- Usar **react-hook-form** con resolver de Zod.
- Validar datos tanto en cliente como en servidor.

## 🚀 Performance

- Usar `React.lazy` para code splitting de rutas.
- Optimizar imágenes (usar formatos modernos).
- Evitar re-renders innecesarios (usar `useMemo`, `useCallback`).

## 📝 Código

### Imports

- Ordenar imports: externos → internos → relativos
- Agrupar imports: React → librerías → componentes → utilidades → tipos

### Naming

- Variables y funciones: camelCase
- Componentes: PascalCase
- Constantes: UPPER_SNAKE_CASE
- Archivos: PascalCase para componentes, camelCase para utilidades

### Comentarios

- Escribir código autoexplicativo.
- Comentar solo cuando sea necesario explicar el "por qué", no el "qué".
- Usar JSDoc para funciones públicas.

## 🧹 Clean Code

- Funciones pequeñas y con una sola responsabilidad.
- Evitar anidación profunda (máximo 3 niveles).
- Extraer lógica compleja a hooks o utilidades.
- No duplicar código (DRY principle).

## 🔒 Seguridad

- Nunca exponer keys secretas en el cliente.
- Validar y sanitizar inputs del usuario.
- Usar RLS policies en Supabase.
- Implementar rate limiting donde sea necesario.

## 📦 Dependencias

- Mantener dependencias actualizadas.
- No agregar dependencias innecesarias.
- Preferir soluciones nativas cuando sea posible.

## ✅ Checklist antes de commit

- [ ] Código sigue las reglas de este documento
- [ ] TypeScript sin errores
- [ ] ESLint sin errores
- [ ] Componentes son responsive
- [ ] Se usó Tailwind CSS (no CSS externo)
- [ ] Tipos están definidos correctamente
- [ ] RLS policies implementadas
- [ ] Validación de formularios con Zod

---

**Recuerda**: La consistencia es clave. Si tienes dudas, consulta este documento o los ejemplos en el código existente.
