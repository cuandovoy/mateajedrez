import {
  BarChart3,
  Boxes,
  Building2,
  FileText,
  Globe,
  Shield,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
} from 'lucide-react'
import { Link } from 'react-router-dom'

const modules = [
  {
    title: 'Tienda Online Lista para Vender',
    description:
      'Catálogo público con categorías, carrito, checkout y confirmación de órdenes para convertir visitas en ventas.',
    icon: ShoppingBag,
  },
  {
    title: 'Gestión de Productos Avanzada',
    description:
      'Control de productos, variantes, imágenes, códigos de barras y proveedores desde un panel unificado.',
    icon: Boxes,
  },
  {
    title: 'Inventario Multi Sucursal',
    description:
      'Stock por sucursal, ajustes, recepciones, transferencias internas y alertas de stock bajo en tiempo real.',
    icon: Building2,
  },
  {
    title: 'Operación de Ventas y Caja',
    description:
      'Seguimiento de órdenes, flujo de pagos y sesiones de caja para mantener trazabilidad de cada movimiento.',
    icon: Wallet,
  },
  {
    title: 'Clientes y Relación Comercial',
    description:
      'Gestión completa de clientes, datos de contacto y soporte comercial para fidelizar y escalar ventas.',
    icon: Users,
  },
  {
    title: 'Roles, Permisos y Auditoría',
    description:
      'Control de accesos por rol, administración de permisos y logs de auditoría para operar con seguridad.',
    icon: ShieldCheck,
  },
]

const stats = [
  { label: 'Módulos Integrados', value: '10+' },
  { label: 'Áreas Cubiertas', value: 'Venta + Operación' },
  { label: 'Enfoque', value: 'Crecimiento Comercial' },
]

const clientProfiles = [
  {
    title: 'Emprendimientos en crecimiento',
    description:
      'Ideal para equipos que necesitan vender online y ordenar su operación sin sumar múltiples herramientas.',
    icon: Globe,
  },
  {
    title: 'Tiendas con varias sucursales',
    description:
      'Control de stock por sucursal, transferencias y trazabilidad para mantener consistencia comercial.',
    icon: Building2,
  },
  {
    title: 'Operaciones con control interno',
    description:
      'Roles, permisos y auditoría para organizaciones que requieren seguridad y procesos claros.',
    icon: Shield,
  },
]

export function Landing() {
  return (
    <div className="bg-zinc-50 text-zinc-900">
      <section className="bg-gradient-to-b from-zinc-100 via-zinc-50 to-zinc-50 border-b border-zinc-200">
        <div className="container-custom py-16 md:py-24">
          <div className="max-w-4xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-zinc-900 text-zinc-100 px-4 py-1 text-sm font-medium">
              <ShoppingCart className="h-4 w-4" />
              Plataforma de E-commerce y Gestión Comercial
            </p>
            <h1 className="mt-5 text-4xl md:text-5xl font-bold text-zinc-900 leading-tight">
              Vende más con una plataforma completa para tienda, inventario y operación
            </h1>
            <p className="mt-5 text-lg text-zinc-600 max-w-3xl">
              Este sistema unifica la tienda online y el backoffice en un solo flujo:
              productos, stock, órdenes, transferencias, caja, clientes y control de permisos.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/products"
                className="inline-flex items-center justify-center rounded-lg bg-zinc-900 text-zinc-100 px-6 py-3 text-sm font-semibold hover:bg-zinc-800 transition-colors"
              >
                Ver Tienda
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-800 px-6 py-3 text-sm font-semibold hover:bg-zinc-100 transition-colors"
              >
                Acceder al Panel
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container-custom py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-zinc-200 p-5 bg-white">
              <p className="text-sm text-zinc-500">{stat.label}</p>
              <p className="mt-2 text-2xl font-bold text-zinc-900">{stat.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-custom pb-16 md:pb-24">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-zinc-900">Resumen de la Plataforma</h2>
          <p className="text-zinc-600 mt-2">
            Módulos diseñados para sostener crecimiento comercial y operación diaria.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => {
            const Icon = module.icon
            return (
              <article key={module.title} className="rounded-2xl border border-zinc-200 p-6 bg-white shadow-sm">
                <div className="h-11 w-11 rounded-lg bg-zinc-100 text-zinc-700 flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-zinc-900">{module.title}</h3>
                <p className="mt-2 text-sm text-zinc-600 leading-relaxed">{module.description}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="bg-zinc-100 border-y border-zinc-200">
        <div className="container-custom py-14">
          <div className="max-w-4xl">
            <h2 className="text-3xl font-bold text-zinc-900">
              Flujo operativo end-to-end
            </h2>
            <p className="mt-3 text-zinc-600">
              Desde la publicación del producto hasta el cierre de caja, el sistema mantiene trazabilidad de inventario, órdenes y movimientos.
            </p>
          </div>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl bg-white border border-zinc-200 p-4">
              <FileText className="h-5 w-5 text-zinc-700" />
              <p className="mt-2 text-sm font-semibold text-zinc-900">Catálogo y Publicación</p>
            </div>
            <div className="rounded-xl bg-white border border-zinc-200 p-4">
              <Truck className="h-5 w-5 text-zinc-700" />
              <p className="mt-2 text-sm font-semibold text-zinc-900">Inventario y Transferencias</p>
            </div>
            <div className="rounded-xl bg-white border border-zinc-200 p-4">
              <Wallet className="h-5 w-5 text-zinc-700" />
              <p className="mt-2 text-sm font-semibold text-zinc-900">Órdenes y Caja</p>
            </div>
            <div className="rounded-xl bg-white border border-zinc-200 p-4">
              <BarChart3 className="h-5 w-5 text-zinc-700" />
              <p className="mt-2 text-sm font-semibold text-zinc-900">Reportes y Auditoría</p>
            </div>
          </div>
        </div>
      </section>

      <section className="container-custom py-14 md:py-16">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-zinc-900">Pensado para distintos tipos de clientes</h2>
          <p className="text-zinc-600 mt-2">
            La plataforma se adapta a diferentes modelos de negocio, desde comercios pequeños hasta operaciones con mayor estructura.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {clientProfiles.map((profile) => {
            const Icon = profile.icon
            return (
              <article key={profile.title} className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="h-10 w-10 rounded-lg bg-zinc-100 text-zinc-700 flex items-center justify-center">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-zinc-900">{profile.title}</h3>
                <p className="mt-2 text-sm text-zinc-600 leading-relaxed">{profile.description}</p>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
