import {
  ArrowRight,
  BarChart3,
  Boxes,
  Building2,
  Check,
  ChevronRight,
  FileText,
  ImageIcon,
  Package,
  Receipt,
  Shield,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Users,
  Wallet,
  X,
  Zap
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'

const BUSINESS_TYPES = [
  'Tienda de ropa y accesorios',
  'Ferretería / Materiales de construcción',
  'Farmacia / Perfumería',
  'Supermercado / Almacén',
  'Librería / Papelería',
  'Electrodomésticos / Tecnología',
  'Joyería / Relojería',
  'Distribuidora / Mayorista',
  'Restaurante / Bar',
  'Otro',
]

const WA_NUMBER = '59898157459'

function buildWaUrl(fields: { name: string; lastName: string; phone: string; business: string }, plan?: string) {
  const lines = [
    `Hola, me interesa Axiostock${plan ? ` (plan ${plan})` : ''}.`,
    `Nombre: ${fields.name} ${fields.lastName}`,
    `Teléfono: ${fields.phone}`,
    `Tipo de negocio: ${fields.business}`,
  ]
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`
}

function ContactModal({ onClose, plan }: { onClose: () => void; plan?: string }) {
  const [name, setName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [business, setBusiness] = useState('')
  const [customBusiness, setCustomBusiness] = useState('')
  const firstRef = useRef<HTMLInputElement>(null)

  useEffect(() => { firstRef.current?.focus() }, [])

  const isOther = business === 'Otro'
  const finalBusiness = isOther ? customBusiness.trim() : business

  const canSubmit = name.trim() && lastName.trim() && phone.trim() && finalBusiness

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    const url = buildWaUrl({ name: name.trim(), lastName: lastName.trim(), phone: phone.trim(), business: finalBusiness }, plan)
    window.open(url, '_blank', 'noopener,noreferrer')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors">
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-bold text-zinc-900">Empezar con Axiostock</h2>
        <p className="mt-1 text-sm text-zinc-500">Completá tus datos y te contactamos por WhatsApp.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">Nombre</label>
              <input
                ref={firstRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Juan"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">Apellido</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="García"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                required
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">Teléfono / WhatsApp</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+598 99 000 000"
              type="tel"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700">Tipo de negocio</label>
            <select
              value={business}
              onChange={(e) => setBusiness(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 bg-white"
              required
            >
              <option value="">Seleccioná una opción</option>
              {BUSINESS_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          {isOther && (
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">¿Cuál es tu negocio?</label>
              <input
                value={customBusiness}
                onChange={(e) => setCustomBusiness(e.target.value)}
                placeholder="Describí tu negocio"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                required
              />
            </div>
          )}
          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-2 w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md shadow-red-600/20"
          >
            Contactar por WhatsApp
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  )
}

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
  'La factura electrónica: un trámite aparte que da miedo',
  'Decisiones de compra basadas en intuición, no en datos',
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
  { text: 'Config. de notificaciones', included: true },
  { text: 'Transferencias entre sucursales', included: false },
  { text: 'Reportes avanzados', included: false },
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
]

const clientProfiles = [
  {
    quote: '"Siempre hay plata que falta y nunca sé de dónde."',
    persona: 'El dueño pragmático',
    title: 'Negocio con 1 a 4 empleados',
    description:
      'Controlá la caja por operador, el stock en tiempo real y emitís la factura DGI sin salir del sistema. Sin curva de aprendizaje.',
    icon: Wallet,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
  },
  {
    quote: '"Tengo que llamar a la sucursal para saber si hay mercadería."',
    persona: 'El emprendedor en crecimiento',
    title: 'Abriendo la segunda sucursal',
    description:
      'Coordinar dos puntos de venta con WhatsApp y Excel ya no alcanza. Con Axiostock tenés el stock de cada sucursal en tiempo real, desde cualquier lugar.',
    icon: Building2,
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-700',
  },
  {
    quote: '"Cada cliente mío usa un sistema diferente — o ninguno."',
    persona: 'El contador asesor',
    title: 'Asesorás PyMEs uruguayas',
    description:
      'Axiostock viene listo para DGI desde el primer día. Recomendalo a tus clientes con confianza: ellos operan solos y los números cuadran.',
    icon: Receipt,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
  },
]

const comparisonRows: { label: string; axio: boolean | string; excel: boolean | string; legacy: boolean | string }[] = [
  { label: 'Facturación DGI integrada nativa', axio: true, excel: false, legacy: false },
  { label: 'Stock multi-sucursal en tiempo real', axio: true, excel: false, legacy: 'Limitado' },
  { label: 'Tienda online incluida', axio: true, excel: false, legacy: false },
  { label: 'Acceso desde cualquier dispositivo', axio: true, excel: true, legacy: false },
  { label: 'Sin instalación ni mantenimiento', axio: true, excel: true, legacy: false },
  { label: 'Auditoría de caja por operador', axio: true, excel: false, legacy: false },
  { label: 'Reportes automáticos', axio: true, excel: false, legacy: 'Básico' },
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


export function Landing() {
  const [contactModal, setContactModal] = useState<{ open: boolean; plan?: string }>({ open: false })
  const openContact = (plan?: string) => setContactModal({ open: true, plan })

  return (
    <div className="bg-white text-zinc-900">
      {contactModal.open && (
        <ContactModal plan={contactModal.plan} onClose={() => setContactModal({ open: false })} />
      )}
      <Helmet>
        <title>Axiostock — Control de Stock y Gestión Comercial para tu Negocio</title>
        <meta name="description" content="Inventario multi sucursal, facturación electrónica DGI, punto de venta y reportes. Todo conectado en una sola plataforma para PyMEs uruguayas." />
        <meta name="keywords" content="gestión comercial Uruguay, inventario multi sucursal, facturación electrónica DGI, stock, tienda online, punto de venta, caja registradora, reportes Uruguay" />
        <link rel="canonical" href="https://axiostock.com/landing/app" />
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://axiostock.com/landing/app" />
        <meta property="og:title" content="Axiostock — Control de Stock y Gestión Comercial para tu Negocio" />
        <meta property="og:description" content="Inventario multi sucursal, facturación electrónica DGI, punto de venta y reportes. Todo en un solo lugar, hecho para Uruguay." />
        <meta property="og:image" content="https://axiostock.com/adminPanel3.png" />
        <meta property="og:image:width" content="1280" />
        <meta property="og:image:height" content="720" />
        <meta property="og:locale" content="es_UY" />
        <meta property="og:site_name" content="Axiostock" />
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Axiostock — Control de Stock y Gestión Comercial" />
        <meta name="twitter:description" content="Inventario multi sucursal, facturación DGI, punto de venta y reportes. Hecho para Uruguay." />
        <meta name="twitter:image" content="https://axiostock.com/adminPanel3.png" />
        {/* JSON-LD */}
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "Axiostock",
          "description": "Plataforma de gestión comercial con inventario multi sucursal, facturación electrónica DGI, tienda online, punto de venta y reportes. Hecho para PyMEs uruguayas.",
          "applicationCategory": "BusinessApplication",
          "operatingSystem": "Web",
          "url": "https://axiostock.com",
          "offers": [
            { "@type": "Offer", "name": "Starter", "price": "1990", "priceCurrency": "UYU" },
            { "@type": "Offer", "name": "Profesional", "price": "2890", "priceCurrency": "UYU" }
          ],
          "publisher": { "@type": "Organization", "name": "Axiostock", "url": "https://axiostock.com" }
        })}</script>
      </Helmet>

      {/* NAV */}
      <header className="sticky top-0 z-50 border-b border-zinc-100 bg-white/95 backdrop-blur-sm">
        <div className="container-custom flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo2.png" alt="Axiostock" className="h-14 w-auto" />
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
                Inventario multi sucursal, facturación electrónica DGI, punto de venta y reportes. Todo conectado, sin sistemas separados, sin fricciones.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <button
                  onClick={() => openContact()}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3.5 text-sm font-bold text-white hover:bg-red-500 transition-colors shadow-lg shadow-red-600/25"
                >
                  Agendar demo gratis
                  <ArrowRight className="h-4 w-4" />
                </button>
                <a
                  href="https://calendar.app.google/uQEnHKUCMX3DWwd98"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/60 px-6 py-3.5 text-sm font-bold text-zinc-200 hover:bg-zinc-700 transition-colors"
                >
                  Agendar demo
                  <ChevronRight className="h-4 w-4" />
                </a>
              </div>
              {/* Trust pills */}
              <div className="mt-10 flex flex-wrap gap-2">
                {[
                  'Facturación DGI incluida',
                  'Inventario multi sucursal',
                  'Tienda online integrada',
                  'Roles y permisos',
                  'Hecho para Uruguay',
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
              { value: 'CFE', label: 'Facturación DGI nativa' },
              { value: '∞', label: 'Productos en plan Pro' },
              { value: '100%', label: 'Hecho para Uruguay' },
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
                  label="Comparativa de dolores sin sistema vs con Axiostock"
                  aspectRatio="aspect-[16/7]"
                  
                  url='/comparativaDolor.png'
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
            <div className="relative overflow-hidden rounded-2xl aspect-video shadow-2xl shadow-black/40">
              <iframe
                src="https://www.youtube.com/embed/5xjb8Ot4b0Y"
                title="Demo de Axiostock"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            </div>
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

      {/* FIFO / COSTEO */}
      <section className="bg-[#12192C] text-white">
        <div className="container-custom py-16 md:py-20">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:items-center">
            <div>
              <span className="inline-block rounded-full bg-red-600/20 px-3 py-1 text-xs font-semibold text-red-400">
                Gestión de costos
              </span>
              <h2 className="mt-4 text-3xl font-bold md:text-4xl">
                ¿Vendés alimentos, cosméticos o medicamentos?{' '}
                <span className="text-red-500">Tu stock tiene fecha.</span>
              </h2>
              <p className="mt-4 text-zinc-400 leading-relaxed">
                Axiostock rastrea qué mercadería entró primero y la da de baja antes. Así el stock con más tiempo siempre sale primero, evitás vencimientos y el contador cierra el balance con números reales.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  { label: 'Costo promedio ponderado por defecto', desc: 'Compatible con NIIF para PyMEs. Sin configurar nada, el sistema calcula el costo correcto en cada compra.' },
                  { label: 'FIFO activable por organización', desc: 'Para rubros con vencimiento: el lote más antiguo se consume primero. Se activa con un clic desde la configuración.' },
                  { label: 'Margen bruto real en cada venta', desc: 'El costo queda registrado al momento de vender. Nunca perdés de vista cuánto ganás sobre cada producto.' },
                ].map((item) => (
                  <li key={item.label} className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600/20 text-red-400">
                      <Check className="h-3 w-3" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">{item.label}</p>
                      <p className="text-sm text-zinc-400">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-xs text-zinc-500">
                Compatible con lo que esperan los contadores uruguayos y con NIIF para PyMEs.
              </p>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 aspect-[4/3] flex items-center justify-center">
              {/* Reemplazar con imagen representativa de FIFO / lotes de inventario */}
              <div className="flex flex-col items-center gap-4 px-8 text-center">
                <div className="flex items-end gap-2">
                  {[
                    { label: 'Lote 1', date: 'Mar 2025', qty: 12, color: 'bg-red-500', height: 'h-20' },
                    { label: 'Lote 2', date: 'Abr 2025', qty: 30, color: 'bg-zinc-600', height: 'h-32' },
                    { label: 'Lote 3', date: 'May 2025', qty: 25, color: 'bg-zinc-700', height: 'h-28' },
                  ].map((lot) => (
                    <div key={lot.label} className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-zinc-400">{lot.qty} u.</span>
                      <div className={`w-16 rounded-t ${lot.color} ${lot.height} flex items-end justify-center pb-2`}>
                        <span className="text-[9px] font-bold text-white">{lot.label}</span>
                      </div>
                      <span className="text-[10px] text-zinc-500">{lot.date}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-600/10 px-4 py-2">
                  <ArrowRight className="h-4 w-4 text-red-400" />
                  <span className="text-xs text-red-300 font-medium">Lote 1 sale primero</span>
                </div>
                <p className="text-xs text-zinc-500 max-w-[180px]">
                  Reemplazá este placeholder con una imagen real de tu sistema
                </p>
              </div>
            </div>
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
            ¿Te suena alguna de estas frases?
          </h2>
          <p className="mt-4 text-zinc-500 max-w-xl mx-auto">
            Si la respuesta es sí, Axiostock es para vos.
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
                  <p className="text-sm italic text-zinc-500 leading-relaxed border-l-2 border-red-300 pl-3">
                    {profile.quote}
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${profile.iconBg}`}>
                      <Icon className={`h-5 w-5 ${profile.iconColor}`} />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-red-600">{profile.persona}</p>
                      <p className="text-xs text-zinc-400">{profile.title}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-zinc-500 leading-relaxed">{profile.description}</p>
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

      {/* CFE TEASER */}
      <section className="relative overflow-hidden border-y border-zinc-200 bg-[#12192C]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_right,_rgba(220,38,38,0.12),_transparent_55%)]" />
        <div className="container-custom relative py-14 md:py-18">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800/60 px-3 py-1 text-xs font-medium text-zinc-300">
                <Receipt className="h-3.5 w-3.5 text-red-400" />
                Nuevo · Integrado con Biller v2
              </span>
              <h2 className="mt-4 text-2xl font-extrabold text-white md:text-3xl leading-tight">
                Facturación electrónica{' '}
                <span className="text-red-400">directo desde tu venta</span>
              </h2>
              <p className="mt-3 text-zinc-400 leading-relaxed max-w-lg">
                Emití e-Tickets y e-Facturas certificadas por DGI sin salir del sistema. Un clic al confirmar la orden y el CFE llega a Biller en tiempo real.
              </p>
              <ul className="mt-5 space-y-2">
                {['e-Ticket y e-Factura', 'PDF descargable al instante', 'Historial y anulación desde el panel', 'Configurable por organización'].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                    <Check className="h-4 w-4 flex-shrink-0 text-red-400" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/facturacion-electronica"
                className="mt-7 inline-flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 text-sm font-bold text-white hover:bg-red-500 transition-colors shadow-lg shadow-red-600/25"
              >
                Ver más
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: FileText, label: 'e-Ticket', desc: 'Consumidor final', color: 'text-blue-400', bg: 'bg-blue-600/10' },
                { icon: Building2, label: 'e-Factura', desc: 'Con RUT del cliente', color: 'text-green-400', bg: 'bg-green-600/10' },
                { icon: Shield, label: 'Certificado DGI', desc: 'Uruguay', color: 'text-purple-400', bg: 'bg-purple-600/10' },
                { icon: Zap, label: 'Tiempo real', desc: 'PDF instantáneo', color: 'text-red-400', bg: 'bg-red-600/10' },
              ].map(({ icon: Icon, label, desc, color, bg }) => (
                <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${bg}`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white">{label}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* COMPETITIVE */}
      <section className="bg-zinc-50 border-y border-zinc-200">
        <div className="container-custom py-16 md:py-24">
          <div className="mb-12 text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-red-600">Por qué Axiostock</p>
            <h2 className="mt-3 text-3xl font-bold text-zinc-900 md:text-4xl">
              ¿Por qué no quedarte con lo que ya tenés?
            </h2>
            <p className="mt-4 text-zinc-500 max-w-xl mx-auto">
              Excel y los sistemas instalados tienen una sola ventaja: ya los conocés. Todo lo demás es desventaja.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="mx-auto w-full max-w-3xl border-collapse">
              <thead>
                <tr className="border-b-2 border-zinc-200">
                  <th className="pb-4 pr-6 text-left text-sm font-medium text-zinc-400 w-2/5" />
                  <th className="pb-4 text-center">
                    <span className="inline-block rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold text-white">
                      Axiostock
                    </span>
                  </th>
                  <th className="pb-4 px-4 text-center text-sm font-semibold text-zinc-400">
                    Excel /<br />cuadernos
                  </th>
                  <th className="pb-4 text-center text-sm font-semibold text-zinc-400">
                    Sistema<br />legacy
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {comparisonRows.map(({ label, axio, excel, legacy }) => (
                  <tr key={label} className="bg-white">
                    <td className="py-3.5 pr-6 text-sm text-zinc-700">{label}</td>
                    <td className="py-3.5 text-center">
                      {axio === true
                        ? <Check className="mx-auto h-5 w-5 text-red-500" />
                        : <X className="mx-auto h-5 w-5 text-zinc-300" />}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {excel === true
                        ? <Check className="mx-auto h-5 w-5 text-zinc-400" />
                        : typeof excel === 'string'
                        ? <span className="text-xs text-zinc-400">{excel}</span>
                        : <X className="mx-auto h-5 w-5 text-zinc-300" />}
                    </td>
                    <td className="py-3.5 text-center">
                      {legacy === true
                        ? <Check className="mx-auto h-5 w-5 text-zinc-400" />
                        : typeof legacy === 'string'
                        ? <span className="text-xs text-zinc-400">{legacy}</span>
                        : <X className="mx-auto h-5 w-5 text-zinc-300" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

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
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-5 py-2 text-sm font-semibold text-green-700">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-[10px] font-bold text-white">%</span>
            Pagando anualmente — <span className="text-green-600">10% OFF</span>
          </div>
        </div>

        <div className="mx-auto mb-10 max-w-2xl rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-center">
          <p className="text-sm text-zinc-600 leading-relaxed">
            ¿Cuánto te cuesta cada día no saber cuánto falta en tu caja, o perder una venta por stock mal manejado?{' '}
            <span className="font-semibold text-zinc-800">El costo del descontrol siempre es mayor que el del sistema.</span>
          </p>
        </div>

        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
          {/* STARTER */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Starter</p>
              <h3 className="mt-2 text-2xl font-bold text-zinc-900">Para arrancar</h3>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-4xl font-extrabold text-zinc-900">$1.990</span>
                <span className="mb-1 text-sm text-zinc-400">UYU / mes</span>
              </div>
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
            <button
              onClick={() => openContact('Starter')}
              className="mt-8 inline-flex w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 transition-colors"
            >
              Comenzar con Starter
            </button>
          </div>

          {/* PROFESIONAL */}
          <div className="relative rounded-2xl border-2 border-red-500 bg-[#12192C] p-8 text-white shadow-xl shadow-red-600/10">
            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-red-600 px-4 py-1 text-xs font-bold text-white shadow">
              RECOMENDADO
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-red-400">Profesional</p>
              <h3 className="mt-2 text-2xl font-bold text-white">Para escalar</h3>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-4xl font-extrabold text-white">$2.890</span>
                <span className="mb-1 text-sm text-zinc-400">UYU / mes</span>
              </div>
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
            <button
              onClick={() => openContact('Profesional')}
              className="mt-8 inline-flex w-full items-center justify-center rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:bg-red-500 transition-colors shadow-md shadow-red-600/30"
            >
              Comenzar con Profesional
            </button>
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
              Dejá atrás las planillas y las herramientas desconectadas. Axiostock unifica todo en un sistema que crece con vos.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <a
                href="https://axiostock.com/minegocio"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-7 py-3.5 text-sm font-bold text-white hover:bg-red-500 transition-colors shadow-lg shadow-red-600/25"
              >
                Ver la tienda demo
                <ArrowRight className="h-4 w-4" />
              </a>
              <button
                onClick={() => openContact()}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/60 px-7 py-3.5 text-sm font-bold text-zinc-200 hover:bg-zinc-700 transition-colors"
              >
                Contactar por WhatsApp
              </button>
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
              <img src="/logo1.png" alt="Axiostock" className="h-10 w-auto brightness-0 invert opacity-70" />
              <p className="mt-3 text-sm text-zinc-500 leading-relaxed">
                Control de stock y gestión comercial para negocios en crecimiento.
              </p>
            </div>
            {/* Links */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-4">Plataforma</p>
              <ul className="space-y-2">
                {[
                  { label: 'Ver tienda demo', href: 'https://axiostock.com/minegocio' },
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
                  href="https://wa.me/59898157459?text=Hola%2C%20quiero%20saber%20m%C3%A1s%20sobre%20Axiostock"
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
            <p>© {new Date().getFullYear()} Axiostock — Control de Stock & Gestión Comercial</p>
            <p className="text-zinc-700">Todos los derechos reservados</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
