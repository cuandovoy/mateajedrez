# Ecommerce App - Vite + React + Supabase

Aplicación ecommerce completa construida con Vite, React, TypeScript, Tailwind CSS y Supabase.

## 🚀 Características

- **Frontend Moderno**: Vite + React + TypeScript
- **Estilos**: Tailwind CSS (obligatorio en todo el proyecto)
- **Backend**: Supabase (Base de datos PostgreSQL + Auth)
- **Estado Global**: Zustand
- **Validación**: Zod + React Hook Form
- **Carrito de Compras**: Funcionalidad completa
- **Panel de Administración**: Gestión de productos, categorías y stock
- **Autenticación**: Sistema de usuarios con roles (user/admin)
- **Seguridad**: Row Level Security (RLS) en todas las tablas

## 📋 Requisitos Previos

- Node.js 18+ y npm/yarn
- Cuenta de Supabase (gratuita en [supabase.com](https://supabase.com))

## 🛠️ Instalación

1. **Clonar el repositorio** (si aplica)
   ```bash
   git clone <repository-url>
   cd vibe-coding-ecommerce-supabase
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp .env.example .env
   ```
   
   Edita el archivo `.env` y agrega tus credenciales de Supabase:
   ```env
   VITE_SUPABASE_URL=tu_url_de_supabase
   VITE_SUPABASE_ANON_KEY=tu_anon_key_de_supabase
   ```

4. **Ejecutar migraciones de base de datos**
   
   Ve a tu proyecto en Supabase Dashboard:
   - SQL Editor → New Query
   - Copia y ejecuta el contenido de `supabase/migrations/001_initial_schema.sql`
   - Luego ejecuta `supabase/migrations/002_row_level_security.sql`

5. **Iniciar el servidor de desarrollo**
   ```bash
   npm run dev
   ```

   La aplicación estará disponible en `http://localhost:5173`

## 📁 Estructura del Proyecto

```
├── src/
│   ├── components/       # Componentes reutilizables
│   │   ├── ui/          # Componentes UI básicos
│   │   ├── layout/      # Header, Footer
│   │   └── features/    # Componentes específicos
│   ├── pages/           # Páginas de la aplicación
│   │   └── admin/       # Páginas de administración
│   ├── store/           # Estado global (Zustand)
│   ├── lib/             # Utilidades y configuraciones
│   ├── types/           # Tipos TypeScript
│   └── routes/          # Configuración de rutas
├── supabase/
│   └── migrations/      # Migraciones de base de datos
├── CODING_RULES.md      # Reglas de desarrollo
└── README.md            # Este archivo
```

## 🗄️ Estructura de Base de Datos

### Tablas Principales

- **categories**: Categorías de productos
- **products**: Productos con stock, precio, imágenes
- **user_profiles**: Perfiles de usuario con roles
- **cart_items**: Items del carrito de compras
- **orders**: Órdenes de compra
- **order_items**: Items de cada orden

### Roles

- **user**: Usuario regular (puede comprar)
- **admin**: Administrador (puede gestionar productos, categorías, etc.)

## 🔐 Seguridad

- Row Level Security (RLS) habilitado en todas las tablas
- Políticas de seguridad configuradas:
  - Usuarios solo pueden ver/modificar sus propios datos
  - Admins tienen acceso completo
  - Productos activos visibles para todos
  - Carrito y órdenes privados por usuario

## 🎨 Reglas de Desarrollo

Consulta el archivo `CODING_RULES.md` para las reglas y convenciones del proyecto.

**Puntos clave:**
- ✅ SIEMPRE usar Tailwind CSS (no CSS externo)
- ✅ TypeScript obligatorio
- ✅ Componentes en PascalCase
- ✅ Hooks en camelCase con prefijo `use`
- ✅ Validación con Zod
- ✅ Estado global con Zustand

## 📝 Scripts Disponibles

- `npm run dev` - Inicia el servidor de desarrollo
- `npm run build` - Construye la aplicación para producción
- `npm run preview` - Previsualiza la build de producción
- `npm run lint` - Ejecuta el linter
- `npm run type-check` - Verifica tipos TypeScript

## 🚀 Despliegue

1. **Build de producción**
   ```bash
   npm run build
   ```

2. **Desplegar en Vercel/Netlify/etc.**
   - Conecta tu repositorio
   - Configura las variables de entorno
   - Deploy automático

## 👤 Crear Usuario Admin

Para crear un usuario administrador, ejecuta en Supabase SQL Editor:

```sql
-- Primero crea el usuario normalmente desde la app
-- Luego actualiza su rol a admin:
UPDATE user_profiles
SET role = 'admin'
WHERE user_id = 'TU_USER_ID_AQUI';
```

## 📚 Tecnologías Utilizadas

- **Vite**: Build tool y dev server
- **React 18**: Biblioteca UI
- **TypeScript**: Tipado estático
- **Tailwind CSS**: Framework CSS utility-first
- **Supabase**: Backend as a Service
- **Zustand**: Estado global
- **React Router**: Enrutamiento
- **React Hook Form**: Manejo de formularios
- **Zod**: Validación de esquemas
- **Lucide React**: Iconos

## 🤝 Contribuir

1. Lee `CODING_RULES.md` para entender las convenciones
2. Crea una rama para tu feature
3. Asegúrate de seguir las reglas de estilo
4. Envía un pull request

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

---

**Nota**: Asegúrate de configurar correctamente las variables de entorno y ejecutar las migraciones antes de usar la aplicación.
