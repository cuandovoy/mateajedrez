import { useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import {
  ArrowRight,
  Check,
  ChevronRight,
  FileText,
  Lock,
  Receipt,
  RefreshCw,
  Send,
  ShieldCheck,
  Zap,
  AlertCircle,
  Clock,
  Building2,
} from 'lucide-react'
import { Link } from 'react-router-dom'


const benefits = [
  {
    icon: FileText,
    title: 'e-Ticket y e-Factura',
    description:
      'Emitís e-Tickets para consumidores finales y e-Facturas para empresas con RUT, todo desde el mismo flujo de venta.',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: Zap,
    title: 'Un clic desde la venta',
    description:
      'El comprobante se genera automáticamente al confirmar la orden. Sin exportar archivos ni entrar a sistemas externos.',
    color: 'bg-red-50 text-red-600',
  },
  {
    icon: Lock,
    title: 'Directo a DGI',
    description:
      'Los comprobantes se envían en tiempo real a la DGI mediante la plataforma certificada Biller v2. Total trazabilidad.',
    color: 'bg-green-50 text-green-600',
  },
  {
    icon: ShieldCheck,
    title: 'PDF en el momento',
    description:
      'Cada CFE genera su PDF listo para enviar al cliente. Podés descargarlo o compartirlo desde el panel en cualquier momento.',
    color: 'bg-purple-50 text-purple-600',
  },
  {
    icon: RefreshCw,
    title: 'Anulación desde el panel',
    description:
      'Si necesitás anular un comprobante, lo hacés desde el detalle de la orden sin salir del sistema ni contactar soporte.',
    color: 'bg-orange-50 text-orange-600',
  },
  {
    icon: Building2,
    title: 'Configurable por organización',
    description:
      'Cada organización tiene su propia configuración de IVA, sucursal DGI y modo de facturación (retail o B2B).',
    color: 'bg-slate-100 text-slate-700',
  },
]

const features = [
  {
    label: 'e-Ticket (tipo 101)',
    desc: 'Para ventas a consumidores finales',
  },
  {
    label: 'e-Factura (tipo 111)',
    desc: 'Para clientes con RUT registrado',
  },
  {
    label: 'Notas de crédito',
    desc: 'Vinculadas a la orden de origen',
  },
  {
    label: 'Historial de comprobantes',
    desc: 'Con filtros por fecha, tipo y estado',
  },
  {
    label: 'Re-descarga de PDF',
    desc: 'En cualquier momento desde la orden',
  },
  {
    label: 'Anulación en línea',
    desc: 'Con registro de auditoría incluido',
  },
  {
    label: 'Precios con IVA incluido',
    desc: 'O precios netos — según tu modelo',
  },
  {
    label: 'Tasa de IVA por defecto',
    desc: 'Exento, 10% o 22% configurable',
  },
  {
    label: 'Venta manual con CFE',
    desc: 'Desde el punto de venta presencial',
  },
  {
    label: 'Checkout online con CFE',
    desc: 'Tus clientes solicitan factura al comprar',
  },
  {
    label: 'Ambiente test y producción',
    desc: 'Probá sin afectar tus comprobantes reales',
  },
  {
    label: 'Multi-organización',
    desc: 'Cada empresa tiene su configuración propia',
  },
]

const steps = [
  {
    step: '01',
    icon: Building2,
    title: 'Configurá tu cuenta Biller',
    description:
      'Ingresá tu token de Biller y configurá tu sucursal DGI desde el panel de administración de tu organización.',
  },
  {
    step: '02',
    icon: Receipt,
    title: 'Elegí el tipo de comprobante',
    description:
      'Al crear una venta, indicás si querés emitir e-Ticket o e-Factura. Para facturas, ingresás el RUT y razón social del cliente.',
  },
  {
    step: '03',
    icon: Send,
    title: 'El CFE se emite automáticamente',
    description:
      'Al confirmar la orden, el sistema envía el comprobante a DGI en tiempo real a través de Biller. El PDF se descarga al instante.',
  },
  {
    step: '04',
    icon: Clock,
    title: 'Gestioná desde el historial',
    description:
      'Accedé a todos tus comprobantes emitidos, filtrá por fecha o tipo, re-descargá PDFs y anulá desde el panel cuando lo necesités.',
  },
]

const faqs = [
  {
    q: '¿Necesito tener cuenta en Biller?',
    a: 'Sí. Biller es la plataforma certificada por DGI que procesa los CFE. Necesitás crear tu cuenta en biller.uy y obtener tu token de API para configurarlo en Axiostock.',
  },
  {
    q: '¿Tiene costo adicional la facturación electrónica?',
    a: 'La integración con Biller está incluida en Axiostock sin costo extra. Biller puede tener sus propios costos según el volumen de comprobantes. Consultá directamente en biller.uy.',
  },
  {
    q: '¿Funciona tanto para ventas online como presenciales?',
    a: 'Sí. Podés emitir CFE desde el checkout de tu tienda online y también desde el punto de venta presencial (caja) de Axiostock.',
  },
  {
    q: '¿Qué pasa si falla la conexión con DGI?',
    a: 'Si el CFE no puede emitirse, la orden se guarda igual y el sistema registra el intento fallido. Podés reintentar la emisión desde el detalle de la orden.',
  },
  {
    q: '¿Puedo configurar precios con o sin IVA?',
    a: 'Sí. Configurás si tus precios ya incluyen IVA (retail) o son precios netos (B2B). También elegís la tasa por defecto: exento, 10% o 22%.',
  },
  {
    q: '¿Puedo anular un comprobante ya emitido?',
    a: 'Sí. Desde el detalle de la orden podés anular el CFE en línea. El sistema notifica a DGI y registra la anulación con fecha y usuario.',
  },
]

export function LandingFacturacion() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  return (
    <div className="bg-white text-zinc-900">
      <Helmet>
        <title>Facturación Electrónica para tu Negocio en Uruguay | Axiostock</title>
        <meta name="description" content="Emití e-Tickets y e-Facturas certificadas por DGI directamente desde tu flujo de ventas. Integrado con Biller v2. Sin sistemas separados, sin exportar archivos." />
        <meta name="keywords" content="facturación electrónica Uruguay, CFE, e-Ticket, e-Factura, DGI Uruguay, Biller, comprobante fiscal electrónico, factura electrónica negocio" />
        <link rel="canonical" href="https://axiostock.com/facturacion-electronica" />
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://axiostock.com/facturacion-electronica" />
        <meta property="og:title" content="Facturación Electrónica para tu Negocio en Uruguay | Axiostock" />
        <meta property="og:description" content="Emití e-Tickets y e-Facturas certificadas por DGI desde tu venta. Integrado con Biller v2. Un clic y el CFE llega a DGI en tiempo real." />
        <meta property="og:image" content="https://axiostock.com/adminPanel3.png" />
        <meta property="og:image:width" content="1280" />
        <meta property="og:image:height" content="720" />
        <meta property="og:locale" content="es_UY" />
        <meta property="og:site_name" content="Axiostock" />
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Facturación Electrónica para Uruguay | Axiostock" />
        <meta name="twitter:description" content="e-Tickets y e-Facturas certificadas por DGI desde tu flujo de ventas. Integrado con Biller v2." />
        <meta name="twitter:image" content="https://axiostock.com/adminPanel3.png" />
        {/* JSON-LD */}
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": "Facturación Electrónica para tu Negocio en Uruguay",
          "description": "Emití e-Tickets y e-Facturas certificadas por DGI directamente desde tu flujo de ventas con Axiostock.",
          "url": "https://axiostock.com/facturacion-electronica",
          "publisher": { "@type": "Organization", "name": "Axiostock", "url": "https://axiostock.com" },
          "about": {
            "@type": "SoftwareApplication",
            "name": "Axiostock — Facturación Electrónica",
            "featureList": ["e-Ticket DGI Uruguay", "e-Factura DGI Uruguay", "Integración Biller v2", "PDF automático", "Historial de comprobantes", "Anulación en línea"],
            "applicationCategory": "BusinessApplication",
            "operatingSystem": "Web"
          },
          "breadcrumb": {
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Inicio", "item": "https://axiostock.com/landing/app" },
              { "@type": "ListItem", "position": 2, "name": "Facturación Electrónica", "item": "https://axiostock.com/facturacion-electronica" }
            ]
          }
        })}</script>
        {/* FAQ Schema */}
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            { "@type": "Question", "name": "¿Necesito tener cuenta en Biller?", "acceptedAnswer": { "@type": "Answer", "text": "Sí. Biller es la plataforma certificada por DGI que procesa los CFE. Necesitás crear tu cuenta en biller.uy y obtener tu token de API para configurarlo en Axiostock." } },
            { "@type": "Question", "name": "¿Tiene costo adicional la facturación electrónica?", "acceptedAnswer": { "@type": "Answer", "text": "La integración con Biller está incluida en Axiostock sin costo extra. Biller puede tener sus propios costos según el volumen de comprobantes." } },
            { "@type": "Question", "name": "¿Funciona tanto para ventas online como presenciales?", "acceptedAnswer": { "@type": "Answer", "text": "Sí. Podés emitir CFE desde el checkout de tu tienda online y también desde el punto de venta presencial de Axiostock." } },
            { "@type": "Question", "name": "¿Puedo anular un comprobante ya emitido?", "acceptedAnswer": { "@type": "Answer", "text": "Sí. Desde el detalle de la orden podés anular el CFE en línea. El sistema notifica a DGI y registra la anulación con fecha y usuario." } }
          ]
        })}</script>
      </Helmet>

      {/* NAV */}
      <header className="sticky top-0 z-50 border-b border-zinc-100 bg-white/95 backdrop-blur-sm">
        <div className="container-custom flex h-16 items-center justify-between">
          <Link to="/landing/app" className="flex items-center gap-2">
            <img src="/logo2.png" alt="Axiostock" className="h-14 w-auto" />
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-zinc-500 md:flex">
            <a href="#beneficios" className="hover:text-zinc-900 transition-colors">Beneficios</a>
            <a href="#caracteristicas" className="hover:text-zinc-900 transition-colors">Características</a>
            <a href="#como-funciona" className="hover:text-zinc-900 transition-colors">Cómo funciona</a>
            <a href="#faq" className="hover:text-zinc-900 transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              Iniciar sesión
            </Link>
            <a
              href="https://wa.me/59898157459?text=Hola%2C%20quiero%20info%20sobre%20facturaci%C3%B3n%20electr%C3%B3nica%20en%20Axiostock"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-500 transition-colors"
            >
              Consultar
              <ChevronRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden bg-[#12192C] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(220,38,38,0.14),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(59,130,246,0.07),_transparent_60%)]" />

        <div className="container-custom relative py-20 md:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800/60 px-4 py-1.5 text-xs font-medium text-zinc-300">
              <Zap className="h-3.5 w-3.5 text-red-400" />
              Integrado con Biller v2 · Certificado DGI Uruguay
            </span>

            <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl xl:text-6xl">
              Facturación electrónica{' '}
              <span className="text-red-500">para tu negocio</span>
            </h1>

            <p className="mt-5 text-lg text-zinc-400 leading-relaxed max-w-2xl mx-auto">
              Emití e-Tickets y e-Facturas directamente desde tu flujo de ventas. Sin sistemas separados, sin exportar archivos. Un clic y el CFE llega a DGI.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <a
                href="https://wa.me/59898157459?text=Hola%2C%20quiero%20info%20sobre%20facturaci%C3%B3n%20electr%C3%B3nica%20en%20Axiostock"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-7 py-3.5 text-sm font-bold text-white hover:bg-red-500 transition-colors shadow-lg shadow-red-600/25"
              >
                Quiero facturar electrónicamente
                <ArrowRight className="h-4 w-4" />
              </a>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/60 px-7 py-3.5 text-sm font-bold text-zinc-200 hover:bg-zinc-700 transition-colors"
              >
                Ya tengo cuenta
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
              {[
                'e-Ticket y e-Factura',
                'PDF automático',
                'Historial completo',
                'Multi-organización',
                'Anulación en línea',
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
        </div>
      </section>

      {/* CERTIFICACIONES */}
      <section className="border-b border-zinc-100 bg-zinc-50">
        <div className="container-custom py-10">
          <p className="mb-7 text-center text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Integración certificada con
          </p>
          <div className="flex flex-wrap items-center justify-center gap-10">
            <img src="/dgi.png" alt="DGI — Dirección General Impositiva Uruguay" className="h-12 w-auto object-contain" />
            <div className="h-8 w-px bg-zinc-300 hidden sm:block" />
            <img src="/biller.svg" alt="Biller" className="h-10 w-auto object-contain" />
          </div>
          <p className="mt-6 text-center text-xs text-zinc-400 max-w-lg mx-auto">
            Axios utiliza la API Biller v2 para la emisión de Comprobantes Fiscales Electrónicos (CFE) validados por la Dirección General Impositiva de Uruguay.
          </p>
        </div>
      </section>

      {/* BENEFITS */}
      <section id="beneficios" className="container-custom py-16 md:py-24">
        <div className="mb-12 text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-red-600">Por qué elegirlo</p>
          <h2 className="mt-3 text-3xl font-bold text-zinc-900 md:text-4xl">
            Facturá sin fricciones
          </h2>
          <p className="mt-4 text-zinc-500 max-w-xl mx-auto">
            La facturación electrónica no debería ser un proceso separado. En Axios, es parte natural de tu flujo de ventas.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b) => {
            const Icon = b.icon
            return (
              <article
                key={b.title}
                className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm hover:border-red-200 hover:shadow-md transition-all"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${b.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-zinc-900">{b.title}</h3>
                <p className="mt-2 text-sm text-zinc-500 leading-relaxed">{b.description}</p>
              </article>
            )
          })}
        </div>
      </section>

      {/* COMPLIANCE BANNER */}
      <section className="bg-[#12192C] text-white">
        <div className="container-custom py-12">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-shrink-0 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-600/20">
              <ShieldCheck className="h-8 w-8 text-red-400" />
            </div>
            <div className="text-center md:text-left">
              <h3 className="text-xl font-bold">Cumplí con la normativa DGI sin complicaciones</h3>
              <p className="mt-2 text-zinc-400 max-w-2xl">
                La DGI exige la emisión de CFE para empresas que superen ciertos umbrales de facturación. Con Axios, cumplís desde el primer comprobante sin necesidad de implementaciones técnicas ni integraciones costosas.
              </p>
            </div>
            <div className="flex-shrink-0">
              <a
                href="https://wa.me/59898157459?text=Hola%2C%20quiero%20info%20sobre%20facturaci%C3%B3n%20electr%C3%B3nica%20en%20Axiostock"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 text-sm font-bold text-white hover:bg-red-500 transition-colors whitespace-nowrap"
              >
                Consultar ahora
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES LIST */}
      <section id="caracteristicas" className="container-custom py-16 md:py-24">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:items-start">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-red-600">Características</p>
            <h2 className="mt-3 text-3xl font-bold text-zinc-900 md:text-4xl leading-tight">
              Todo lo que necesitás en un solo sistema
            </h2>
            <p className="mt-4 text-zinc-500 leading-relaxed">
              Desde la emisión del primer comprobante hasta la gestión del historial, Axios tiene todo lo que tu negocio necesita para facturar electrónicamente en Uruguay.
            </p>

            <div className="mt-8 rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-zinc-900">¿Necesitás emitir CFE?</p>
                  <p className="mt-1 text-sm text-zinc-500">
                    Si tu empresa está inscripta en DGI como contribuyente de IVA, la emisión de CFE puede ser obligatoria. Consultá con tu contador o directamente en{' '}
                    <span className="font-medium text-zinc-700">dgi.gub.uy</span>.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3">
              <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white border border-zinc-100 p-1">
                  <img src="/dgi.png" alt="DGI" className="h-full w-full object-contain" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">Validado por DGI Uruguay</p>
                  <p className="text-xs text-zinc-400">Dirección General Impositiva · dgi.gub.uy</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white border border-zinc-100 p-1">
                  <img src="/biller.svg" alt="Biller" className="h-full w-full object-contain" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">Powered by Biller v2</p>
                  <p className="text-xs text-zinc-400">Plataforma certificada · biller.uy</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {features.map((f) => (
              <div
                key={f.label}
                className="flex items-start gap-3 rounded-xl border border-zinc-100 bg-zinc-50 p-4"
              >
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                <div>
                  <p className="text-sm font-medium text-zinc-900">{f.label}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="como-funciona" className="bg-[#12192C] text-white">
        <div className="container-custom py-16 md:py-24">
          <div className="mb-12 text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-red-400">Flujo de emisión</p>
            <h2 className="mt-3 text-3xl font-bold md:text-4xl">
              De la venta al CFE en segundos
            </h2>
            <p className="mt-4 text-zinc-400 max-w-xl mx-auto">
              El proceso completo desde la configuración hasta el comprobante firmado digitalmente y enviado a DGI.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => {
              const Icon = s.icon
              return (
                <div key={s.step} className="relative">
                  {i < steps.length - 1 && (
                    <div
                      className="absolute top-8 hidden h-px border-t border-dashed border-zinc-700 lg:block"
                      style={{ left: '2.5rem', width: 'calc(100% - 1.5rem)' }}
                    />
                  )}
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl font-black text-zinc-700">{s.step}</span>
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600/15 text-red-400">
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-white">{s.title}</h3>
                    <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{s.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="container-custom py-16 md:py-24">
        <div className="mx-auto max-w-3xl">
          <div className="mb-12 text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-red-600">Preguntas frecuentes</p>
            <h2 className="mt-3 text-3xl font-bold text-zinc-900 md:text-4xl">
              Resolvemos tus dudas
            </h2>
          </div>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <div
                key={faq.q}
                className="rounded-2xl border border-zinc-200 bg-white p-6"
              >
                <p className="text-sm font-semibold text-zinc-900">{faq.q}</p>
                <p className="mt-2 text-sm text-zinc-500 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-[#12192C] text-white">
        <div className="container-custom py-20 md:py-28 text-center">
          <div className="mx-auto max-w-2xl">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-600/20">
              <Receipt className="h-8 w-8 text-red-400" />
            </div>
            <h2 className="text-3xl font-extrabold md:text-5xl leading-tight">
              Empezá a facturar electrónicamente{' '}
              <span className="text-red-500">hoy mismo</span>
            </h2>
            <p className="mt-5 text-zinc-400 text-lg leading-relaxed">
              Configurás Biller en minutos desde el panel de tu organización. Sin instalaciones, sin intermediarios, sin complicaciones técnicas.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <a
                href="https://wa.me/59898157459?text=Hola%2C%20quiero%20activar%20facturaci%C3%B3n%20electr%C3%B3nica%20en%20Axiostock"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-7 py-3.5 text-sm font-bold text-white hover:bg-red-500 transition-colors shadow-lg shadow-red-600/25"
              >
                Quiero activarlo
                <ArrowRight className="h-4 w-4" />
              </a>
              <Link
                to="/landing/app"
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/60 px-7 py-3.5 text-sm font-bold text-zinc-200 hover:bg-zinc-700 transition-colors"
              >
                Ver todas las funcionalidades
                <ChevronRight className="h-4 w-4" />
              </Link>
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
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <Link to="/landing/app">
              <img src="/logo1.png" alt="Axiostock" className="h-8 w-auto brightness-0 invert opacity-70" />
            </Link>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-zinc-500">
              <Link to="/landing/app" className="hover:text-zinc-300 transition-colors">Inicio</Link>
              <a href="#beneficios" className="hover:text-zinc-300 transition-colors">Beneficios</a>
              <a href="#caracteristicas" className="hover:text-zinc-300 transition-colors">Características</a>
              <a href="#faq" className="hover:text-zinc-300 transition-colors">FAQ</a>
            </div>
            <a
              href="https://wa.me/59898157459"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              WhatsApp: +598 98 157 459
            </a>
          </div>
          <div className="mt-6 border-t border-zinc-800 pt-6 text-center text-xs text-zinc-700">
            © {new Date().getFullYear()} Axiostock — Facturación Electrónica para Uruguay
          </div>
        </div>
      </footer>
    </div>
  )
}
