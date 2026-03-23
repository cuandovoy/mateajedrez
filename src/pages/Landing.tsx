import {
  ArrowRight,
  BarChart3,
  Boxes,
  Building2,
  Check,
  ChevronRight,
  FileText,
  Globe,
  ImageIcon,
  Package,
  Play,
  Shield,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Users,
  Wallet,
  X,
  Zap
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const modules = [
  {
    title: 'Tienda Online Lista para Vender',
    description:
      'Catálogo público con categorías, carrito, checkout y confirmación de órdenes. Convertí visitas en ventas desde el día uno.',
    icon: ShoppingBag,
    tag: 'E-commerce',
    imagePlaceholder: true,
  },
  {
    title: 'Gestión de Productos Avanzada',
    description:
      'Productos con variantes, múltiples imágenes, códigos de barras y proveedores desde un panel unificado.',
    icon: Boxes,
    tag: 'Catálogo',
    imagePlaceholder: true,
  },
  {
    title: 'Inventario Multi Sucursal',
    description:
      'Stock por sucursal, ajustes, recepciones, transferencias internas y alertas de stock bajo en tiempo real.',
    icon: Building2,
    tag: 'Inventario',
    imagePlaceholder: true,
  },
  {
    title: 'Operación de Ventas y Caja',
    description:
      'Seguimiento de órdenes, flujo de pagos y sesiones de caja para trazabilidad de cada movimiento.',
    icon: Wallet,
    tag: 'Ventas',
    imagePlaceholder: true,
  },
  {
    title: 'Clientes y Relación Comercial',
    description:
      'Gestión completa de clientes, datos de contacto y soporte comercial para fidelizar y escalar ventas.',
    icon: Users,
    tag: 'Clientes',
    imagePlaceholder: true,
  },
  {
    title: 'Roles, Permisos y Auditoría',
    description:
      'Control de accesos por rol, permisos granulares y logs de auditoría para operar con seguridad.',
    icon: ShieldCheck,
    tag: 'Seguridad',
    imagePlaceholder: true,
  },
]

const problems = [
  'Planillas de Excel que se desactualizan solas',
  'Stock descoordinado entre sucursales',
  'Órdenes perdidas o sin seguimiento',
  'Herramientas desconectadas entre sí',
  'Sin visibilidad de caja ni movimientos',
  'Reportes que llegan tarde o incompletos',
]

const howItWorks = [
  {
    step: '01',
    title: 'Publicá tu catálogo',
    description: 'Cargá productos con variantes, imágenes y precios. Tu tienda online queda lista en minutos.',
    icon: FileText,
  },
  {
    step: '02',
    title: 'Controlá tu inventario',
    description: 'Gestioná stock por sucursal, recibí alertas de bajo stock y transferí mercadería entre depósitos.',
    icon: Package,
  },
  {
    step: '03',
    title: 'Procesá ventas y pedidos',
    description: 'Gestioná órdenes del canal online, registrá pagos y cerrá sesiones de caja con trazabilidad total.',
    icon: ShoppingCart,
  },
  {
    step: '04',
    title: 'Analizá y tomá decisiones',
    description: 'Reportes de ventas, inventario y clientes para tomar decisiones con datos reales.',
    icon: BarChart3,
  },
]

const starterFeatures = [
  { text: 'Tienda online pública', included: true },
  { text: 'Hasta 700 productos', included: true },
  { text: '1 sucursal', included: true },
  { text: 'Gestión de órdenes', included: true },
  { text: 'Caja registradora', included: true },
  { text: 'Gestión de clientes', included: true },
  { text: 'Transferencias entre sucursales', included: false },
  { text: 'Reportes avanzados', included: false },
  { text: 'Tienda personalizada', included: false },
  { text: 'Config. de notificaciones', included: false },
]

const proFeatures = [
  { text: 'Tienda online pública', included: true },
  { text: 'Productos ilimitados', included: true },
  { text: 'Sucursales ilimitadas', included: true },
  { text: 'Gestión de órdenes', included: true },
  { text: 'Caja registradora', included: true },
  { text: 'Gestión de clientes', included: true },
  { text: 'Transferencias entre sucursales', included: true },
  { text: 'Reportes avanzados', included: true },
  { text: 'Tienda personalizada', included: true },
  { text: 'Config. de notificaciones', included: true },
]

const clientProfiles = [
  {
    title: 'Emprendimientos en crecimiento',
    description:
      'Vendé online y ordenás tu operación sin sumar herramientas separadas. Todo en un solo flujo desde el primer día.',
    icon: Globe,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
  },
  {
    title: 'Tiendas con varias sucursales',
    description:
      'Control de stock por sucursal, transferencias y trazabilidad para mantener consistencia comercial en toda tu red.',
    icon: Building2,
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-700',
  },
  {
    title: 'Operaciones con control interno',
    description:
      'Roles, permisos y auditoría para organizaciones que requieren seguridad y procesos claros en cada área.',
    icon: Shield,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
  },
]

// Placeholder component for images
function ImagePlaceholder({
  className = '',
  label = 'Imagen de pantalla',
  aspectRatio = 'aspect-video',
  url,
}: {
  className?: string
  label?: string
  aspectRatio?: string
  url?: string
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border-2 border-  border-[1px] border-zinc-300 bg-zinc-100 ${aspectRatio} ${className}`}
    >
      {url ? (
        <img src={url} alt={label} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-zinc-400">
          <ImageIcon className="h-6 w-6" />
          <span className="text-xs font-medium">{label}</span>
          <span className="text-[10px] text-zinc-300">Recomendado: 1280×720px</span>
        </div>
      )}
    </div>
  )
}

// Carousel component for multiple images with smooth crossfade
function ImageCarousel({
  className = '',
  urls,
  aspectRatio = 'aspect-video',
  interval = 3500,
}: {
  className?: string
  urls: string[]
  aspectRatio?: string
  interval?: number
}) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (urls.length <= 1) return
    const timer = window.setInterval(() => {
      setCurrent((prev) => (prev + 1) % urls.length)
    }, interval)
    return () => window.clearInterval(timer)
  }, [urls.length, interval])

  return (
    <div className={`relative overflow-hidden rounded-xl ${aspectRatio} ${className}`}>
      {urls.map((url, index) => (
        <img
          key={url}
          src={url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms]"
          style={{ opacity: index === current ? 1 : 0 }}
        />
      ))}
      {urls.length > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {urls.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrent(index)}
              className={`h-1.5 rounded-full transition-all duration-300 ${index === current ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
                }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Placeholder component for video
function VideoPlaceholder({
  className = '',
  label = 'Video demo',
}: {
  className?: string
  label?: string
}) {
  return (
    <div
      className={`group relative flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-zinc-300 bg-gradient-to-br from-zinc-100 to-zinc-200 aspect-video ${className}`}
    >
      <div className="flex flex-col items-center gap-3 text-center text-zinc-400">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-zinc-300 bg-white shadow-sm transition-transform group-hover:scale-105">
          <Play className="h-7 w-7 translate-x-0.5 text-zinc-500" />
        </div>
        <div>
          <span className="block text-sm font-semibold text-zinc-500">{label}</span>
          <span className="text-xs text-zinc-400">Agregá tu video de YouTube o Vimeo aquí</span>
        </div>
      </div>
      <div className="absolute inset-0 rounded-2xl ring-2 ring-inset ring-transparent transition group-hover:ring-red-300" />
    </div>
  )
}

export function Landing() {
  return (
    <div className="bg-white text-zinc-900">

      {/* NAV */}
      <header className="sticky top-0 z-50 border-b border-zinc-100 bg-white/95 backdrop-blur-sm">
        <div className="container-custom flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo2.png" alt="Axios" className="h-14 w-auto" />
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-zinc-500 md:flex">
            <a href="#features" className="hover:text-zinc-900 transition-colors">Funcionalidades</a>
            <a href="#demo" className="hover:text-zinc-900 transition-colors">Demo</a>
            <a href="#plans" className="hover:text-zinc-900 transition-colors">Planes</a>
            <a href="#testimonials" className="hover:text-zinc-900 transition-colors">Testimonios</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden bg-[#12192C] text-white">
        {/* Fondo decorativo */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(220,38,38,0.12),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(220,38,38,0.06),_transparent_60%)]" />
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-red-600/5 blur-3xl" />

        <div className="container-custom relative py-20 md:py-28">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
            {/* Left: Copy */}
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800/60 px-4 py-1.5 text-xs font-medium text-zinc-300">
                <Zap className="h-3.5 w-3.5 text-red-400" />
                Control de Stock & Gestión Comercial
              </span>
              <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl xl:text-6xl">
                Tu negocio completo,{' '}
                <span className="text-red-500">
                  en un solo lugar
                </span>
              </h1>
              <p className="mt-5 text-lg text-zinc-400 leading-relaxed max-w-lg">
                Tienda online, inventario multi sucursal, caja, órdenes, clientes y reportes. Todo conectado para que vendas más y operes sin caos.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <a
                  href="https://wa.me/59898157459?text=Hola%2C%20quiero%20saber%20m%C3%A1s%20sobre%20Axios"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3.5 text-sm font-bold text-white hover:bg-red-500 transition-colors shadow-lg shadow-red-600/25"
                >
                  Probar 14 días gratis
                  <ArrowRight className="h-4 w-4" />
                </a>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/60 px-6 py-3.5 text-sm font-bold text-zinc-200 hover:bg-zinc-700 transition-colors"
                >
                  Acceder al panel
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
              {/* Trust pills */}
              <div className="mt-10 flex flex-wrap gap-2">
                {[
                  '10+ módulos integrados',
                  'Multi sucursal',
                  'Inventario en tiempo real',
                  'Roles y permisos',
                  'Tienda online incluida',
                ].map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800/40 px-3 py-1 text-xs text-zinc-400"
                  >
                    <Check className="h-3 w-3 text-red-400" />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: Dashboard screenshot placeholder */}
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-red-600/5 blur-2xl" />
              <div className="relative">

                <ImageCarousel
                  urls={['/adminPanel3.png']}
                  aspectRatio="aspect-video"
                  interval={3500}
                />
                {/* Badge flotante */}
                <div className="absolute -bottom-4 -left-4 flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 shadow-xl">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600/20">
                    <BarChart3 className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-400">Ventas del mes</p>
                    <p className="text-sm font-bold text-white">Todo en tiempo real</p>
                  </div>
                </div>
                <div className="absolute -top-4 -right-4 flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 shadow-xl">
                  <div className="flex h-2 w-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                  <p className="text-xs font-medium text-zinc-300">Stock actualizado</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <section className="border-b border-zinc-100 bg-zinc-50">
        <div className="container-custom py-10">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { value: '10+', label: 'Módulos integrados' },
              { value: '2', label: 'Planes disponibles' },
              { value: '10.000', label: 'Productos en plan Pro' },
              { value: '360°', label: 'Visibilidad del negocio' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-black text-red-600">{stat.value}</p>
                <p className="mt-1 text-sm text-zinc-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="border-b border-zinc-100">
        <div className="container-custom py-16 md:py-20">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-red-600">El problema</p>
              <h2 className="mt-3 text-3xl font-bold text-zinc-900 md:text-4xl leading-tight">
                ¿Gestionás tu negocio con herramientas que no hablan entre sí?
              </h2>
              <p className="mt-4 text-zinc-500 leading-relaxed">
                La mayoría de los negocios en crecimiento terminan usando planillas, apps sueltas y procesos manuales que generan errores, pérdida de tiempo y decisiones sin datos.
              </p>
              <div className="mt-6">
                <ImagePlaceholder
                  label="Imagen: caos sin sistema / antes vs después"
                  aspectRatio="aspect-[16/7]"
                  
                  url='/papervsadmin.png'
                />
              </div>
            </div>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
              {problems.map((problem) => (
                <li
                  key={problem}
                  className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-zinc-700"
                >
                  <X className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                  {problem}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* DEMO VIDEO */}
      <section id="demo" className="bg-[#12192C] text-white">
        <div className="container-custom py-16 md:py-24">
          <div className="mb-10 text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-red-400">Demo</p>
            <h2 className="mt-3 text-3xl font-bold md:text-4xl">
              Mirá el sistema en acción
            </h2>
            <p className="mt-4 text-zinc-400 max-w-xl mx-auto">
              Un recorrido completo por el panel de administración, la tienda online y la gestión de inventario.
            </p>
          </div>
          <div className="mx-auto max-w-4xl">
            <VideoPlaceholder label="Video demo de Axios — 3 minutos" />
            <p className="mt-4 text-center text-xs text-zinc-500">
              Reemplazá este bloque con un embed de YouTube o Vimeo
            </p>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="container-custom py-16 md:py-24">
        <div className="mb-12 text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-red-600">La solución</p>
          <h2 className="mt-3 text-3xl font-bold text-zinc-900 md:text-4xl">
            Todo lo que tu negocio necesita
          </h2>
          <p className="mt-4 text-zinc-500 max-w-xl mx-auto">
            Módulos diseñados para trabajar juntos. Desde la publicación del producto hasta el cierre de caja.
          </p>
        </div>

        <div className="space-y-16">
          {/* Feature highlight 1: tienda online */}
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-center">
            <div>
              <span className="inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-600">
                E-commerce
              </span>
              <h3 className="mt-3 text-2xl font-bold text-zinc-900">
                Tienda online lista para vender
              </h3>
              <p className="mt-3 text-zinc-500 leading-relaxed">
                Tu catálogo público con categorías, filtros, carrito y checkout completo. Los clientes navegan, eligen y pagan — vos gestionás desde el panel. Sin configuraciones técnicas complejas.
              </p>
              <ul className="mt-5 space-y-2">
                {['Carrito y checkout integrado', 'Variantes de producto', 'Imágenes múltiples', 'Confirmación de órdenes automática'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-zinc-700">
                    <Check className="h-4 w-4 flex-shrink-0 text-red-500" />
                    {f}
                  </li>
                ))}
              </ul>
              <a href="https://axiostock.com/minegocio" target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-500 transition-colors">
                Ver tienda demo <ArrowRight className="h-4 w-4" />
              </a>
            </div>
  
                <ImageCarousel
                  aspectRatio="aspect-video"
                  urls={['/homeFerreteria.png', '/productosFerreteria.png', '/cartFerreteria.png']}
                  interval={3500}
                />
          </div>

          {/* Feature highlight 2: inventario */}
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-center">
            <div className="relative overflow-hidden rounded-xl shadow-lg aspect-[4/3] md:order-1">
              <video
                src="/inventoryLanding.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
            <div className="md:order-2">
              <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                Inventario
              </span>
              <h3 className="mt-3 text-2xl font-bold text-zinc-900">
                Inventario en tiempo real, por sucursal
              </h3>
              <p className="mt-3 text-zinc-500 leading-relaxed">
                Controlá el stock de cada sucursal de forma independiente. Recibí alertas de bajo stock, registrá ajustes y transferí mercadería entre depósitos con trazabilidad completa.
              </p>
              <ul className="mt-5 space-y-2">
                {['Stock por sucursal', 'Alertas de bajo stock', 'Transferencias entre depósitos', 'Historial de movimientos', 'Códigos de barra integrados'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-zinc-700">
                    <Check className="h-4 w-4 flex-shrink-0 text-red-500" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Feature highlight 3: reportes */}
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-center">
            <div>
              <span className="inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-600">
                Reportes
              </span>
              <h3 className="mt-3 text-2xl font-bold text-zinc-900">
                Datos reales para tomar mejores decisiones
              </h3>
              <p className="mt-3 text-zinc-500 leading-relaxed">
                Reportes de ventas, inventario, clientes y finanzas disponibles desde el panel. Sabé qué productos vendés más, cuándo y a quiénes.
              </p>
              <ul className="mt-5 space-y-2">
                {['Reportes de ventas', 'Reporte financiero', 'Comportamiento de clientes', 'Auditoría de operaciones', 'Inventario valorizado'].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-zinc-700">
                    <Check className="h-4 w-4 flex-shrink-0 text-red-500" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <ImageCarousel
              urls={['/reporteClientes.png', '/reporteVentas.png', '/reporteFinanzas.png']}
              aspectRatio="aspect-[4/3]"
              className="shadow-lg"
            />
          </div>
        </div>

        {/* Módulos grid */}
        <div className="mt-20">
          <h3 className="mb-8 text-center text-xl font-bold text-zinc-900">Todos los módulos incluidos</h3>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((module) => {
              const Icon = module.icon
              return (
                <article
                  key={module.title}
                  className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:border-red-200 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#12192C] text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500">
                      {module.tag}
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-zinc-900">{module.title}</h3>
                  <p className="mt-2 text-sm text-zinc-500 leading-relaxed">{module.description}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-[#12192C] text-white">
        <div className="container-custom py-16 md:py-24">
          <div className="mb-12 text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-red-400">Flujo operativo</p>
            <h2 className="mt-3 text-3xl font-bold md:text-4xl">
              Del producto al cierre de caja, sin fisuras
            </h2>
            <p className="mt-4 text-zinc-400 max-w-xl mx-auto">
              El sistema mantiene trazabilidad completa en cada etapa de tu operación.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {howItWorks.map((step, i) => {
              const Icon = step.icon
              return (
                <div key={step.step} className="relative">
                  {/* Connector line */}
                  {i < howItWorks.length - 1 && (
                    <div className="absolute top-8 left-full z-10 hidden h-px w-full -translate-y-0.5 border-t border-dashed border-zinc-700 lg:block" style={{ width: 'calc(100% - 2.5rem)', left: '2.5rem' }} />
                  )}
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl font-black text-zinc-700">{step.step}</span>
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600/15 text-red-400">
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-white">{step.title}</h3>
                    <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Video del flujo */}
          {/* <div className="mt-14 mx-auto max-w-3xl">
            <VideoPlaceholder label="Video: recorrido del flujo completo de ventas" />
          </div> */}
        </div>
      </section>

      {/* FOR WHO */}
      <section id="for-who" className="container-custom py-16 md:py-24">
        <div className="mb-12 text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-red-600">Para quién es</p>
          <h2 className="mt-3 text-3xl font-bold text-zinc-900 md:text-4xl">
            Pensado para distintos modelos de negocio
          </h2>
          <p className="mt-4 text-zinc-500 max-w-xl mx-auto">
            La plataforma se adapta desde comercios pequeños hasta operaciones con estructura compleja.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {clientProfiles.map((profile) => {
            const Icon = profile.icon
            return (
              <article
                key={profile.title}
                className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
              >
                <div className="p-6">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${profile.iconBg}`}>
                    <Icon className={`h-5 w-5 ${profile.iconColor}`} />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-zinc-900">{profile.title}</h3>
                  <p className="mt-2 text-sm text-zinc-500 leading-relaxed">{profile.description}</p>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {/* MODULES VISUAL */}
      <section className="bg-zinc-50 border-y border-zinc-200 py-16 md:py-24">
        <div className="container-custom">
          <div className="mb-12 text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-red-600">Todo en uno</p>
            <h2 className="mt-3 text-3xl font-bold text-zinc-900 md:text-4xl">
              Tres módulos, una sola plataforma
            </h2>
            <p className="mt-4 text-zinc-500 max-w-xl mx-auto">
              Configurá tu negocio, gestioná desde el panel administrativo y vendé en tu tienda online.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="flex flex-col items-center rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm text-center">
              <img src="/undrawSettings.svg" alt="Configuración" className="h-40 w-auto object-contain mb-6" />
              <h3 className="text-lg font-semibold text-zinc-900">Configuración</h3>
              <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
                Personalizá tu tienda, métodos de pago, sucursales y permisos de usuarios en minutos.
              </p>
            </div>
            <div className="flex flex-col items-center rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm text-center">
              <img src="/undrowAdminPanel.svg" alt="Panel administrativo" className="h-40 w-auto object-contain mb-6" />
              <h3 className="text-lg font-semibold text-zinc-900">Panel administrativo</h3>
              <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
                Controlá órdenes, inventario, reportes financieros y punto de venta desde un solo lugar.
              </p>
            </div>
            <div className="flex flex-col items-center rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm text-center">
              <img src="/undrowStore.svg" alt="Tienda online" className="h-40 w-auto object-contain mb-6" />
              <h3 className="text-lg font-semibold text-zinc-900">Tienda online</h3>
              <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
                Tu catálogo disponible 24/7 con carrito, checkout y gestión de pedidos automática.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      {/* <section id="testimonials" className="bg-zinc-50 border-y border-zinc-200">
        <div className="container-custom py-16 md:py-24">
          <div className="mb-12 text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-red-600">Testimonios</p>
            <h2 className="mt-3 text-3xl font-bold text-zinc-900 md:text-4xl">
              Lo que dicen nuestros clientes
            </h2>
            <p className="mt-2 text-zinc-400 text-sm">Reemplazá estos testimonios con casos reales</p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <article key={t.name} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="flex gap-0.5">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="mt-4 text-sm text-zinc-600 leading-relaxed italic">"{t.text}"</p>
                <div className="mt-5 flex items-center gap-3">
                  
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100">
                    <Users className="h-4 w-4 text-zinc-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">{t.name}</p>
                    <p className="text-xs text-zinc-400">{t.role}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-14">
            <p className="text-center text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-6">
              Empresas que confían en Axios
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex h-10 w-28 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-100"
                >
                  <span className="text-xs text-zinc-400">Logo cliente {i + 1}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section> */}

      {/* PLANS */}
      <section id="plans" className="container-custom py-16 md:py-24">
        <div className="mb-12 text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-red-600">Planes</p>
          <h2 className="mt-3 text-3xl font-bold text-zinc-900 md:text-4xl">
            Empezá simple. Crecé sin límites.
          </h2>
          <p className="mt-4 text-zinc-500 max-w-xl mx-auto">
            Dos planes diseñados para acompañar tu crecimiento desde el primer día.
          </p>
        </div>

        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
          {/* STARTER */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Starter</p>
              <h3 className="mt-2 text-2xl font-bold text-zinc-900">Para arrancar</h3>
              <p className="mt-2 text-sm text-zinc-500">
                Todo lo esencial para poner tu negocio en marcha con una sola sucursal.
              </p>
            </div>
            <ul className="mt-8 space-y-3">
              {starterFeatures.map((feature) => (
                <li key={feature.text} className="flex items-center gap-3 text-sm">
                  {feature.included ? (
                    <Check className="h-4 w-4 flex-shrink-0 text-red-500" />
                  ) : (
                    <X className="h-4 w-4 flex-shrink-0 text-zinc-300" />
                  )}
                  <span className={feature.included ? 'text-zinc-700' : 'text-zinc-400'}>
                    {feature.text}
                  </span>
                </li>
              ))}
            </ul>
            <a
              href="https://wa.me/59898157459?text=Hola%2C%20quiero%20empezar%20con%20el%20plan%20Starter"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 transition-colors"
            >
              Comenzar con Starter
            </a>
          </div>

          {/* PROFESIONAL */}
          <div className="relative rounded-2xl border-2 border-red-500 bg-[#12192C] p-8 text-white shadow-xl shadow-red-600/10">
            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-red-600 px-4 py-1 text-xs font-bold text-white shadow">
              RECOMENDADO
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-red-400">Profesional</p>
              <h3 className="mt-2 text-2xl font-bold text-white">Para escalar</h3>
              <p className="mt-2 text-sm text-zinc-400">
                Sin límites de productos ni sucursales. Con reportes avanzados y tienda personalizada.
              </p>
            </div>
            <ul className="mt-8 space-y-3">
              {proFeatures.map((feature) => (
                <li key={feature.text} className="flex items-center gap-3 text-sm">
                  <Check className="h-4 w-4 flex-shrink-0 text-red-400" />
                  <span className="text-zinc-200">{feature.text}</span>
                </li>
              ))}
            </ul>
            <a
              href="https://wa.me/59898157459?text=Hola%2C%20quiero%20empezar%20con%20el%20plan%20Profesional"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex w-full items-center justify-center rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:bg-red-500 transition-colors shadow-md shadow-red-600/30"
            >
              Comenzar con Profesional
            </a>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-[#12192C] text-white">
        <div className="container-custom py-20 md:py-28 text-center">
          <div className="mx-auto max-w-2xl">
            {/* Logo centrado */}
            <h2 className="text-3xl font-extrabold md:text-5xl leading-tight">
              Tu negocio merece operar{' '}
              <span className="text-red-500">con orden y datos reales</span>
            </h2>
            <p className="mt-5 text-zinc-400 text-lg leading-relaxed">
              Dejá atrás las planillas y las herramientas desconectadas. Axios unifica todo en un sistema que crece con vos.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                to="https://axiostock.com/minegocio"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-7 py-3.5 text-sm font-bold text-white hover:bg-red-500 transition-colors shadow-lg shadow-red-600/25"
              >
                Ver la tienda demo
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="https://wa.me/59898157459?text=Hola%2C%20quiero%20saber%20m%C3%A1s%20sobre%20Axios"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/60 px-7 py-3.5 text-sm font-bold text-zinc-200 hover:bg-zinc-700 transition-colors"
              >
                Contactar por WhatsApp
              </a>
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-500">
              {['Sin tarjeta requerida', 'Configuración en minutos', 'Soporte incluido'].map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-red-500" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-zinc-800 bg-zinc-950">
        <div className="container-custom py-10">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Brand */}
            <div>
              <img src="/logo1.png" alt="Axios" className="h-10 w-auto brightness-0 invert opacity-70" />
              <p className="mt-3 text-sm text-zinc-500 leading-relaxed">
                Control de stock y gestión comercial para negocios en crecimiento.
              </p>
            </div>
            {/* Links */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-4">Plataforma</p>
              <ul className="space-y-2">
                {[
                  { label: 'Ver tienda demo', to: '/products' },
                  { label: 'Panel de administración', to: '/login' },
                  { label: 'Funcionalidades', href: '#features' },
                  { label: 'Planes', href: '#plans' },
                ].map((link) => (
                  <li key={link.label}>
                    {link.to ? (
                      <Link to={link.to} className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                        {link.label}
                      </Link>
                    ) : (
                      <a href={link.href} className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            {/* Contact */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-4">Contacto</p>
              <div className="space-y-2">
                <a
                  href="https://wa.me/59898157459?text=Hola%2C%20quiero%20saber%20m%C3%A1s%20sobre%20Axios"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  WhatsApp: +598 98 157 459
                </a>
              </div>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-zinc-800 pt-6 text-xs text-zinc-600 md:flex-row">
            <p>© {new Date().getFullYear()} Axios — Control de Stock & Gestión Comercial</p>
            <p className="text-zinc-700">Todos los derechos reservados</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
