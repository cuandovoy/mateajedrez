import { Helmet } from 'react-helmet-async'
import { MapPin, Navigation, MessageCircle } from 'lucide-react'
import { absoluteUrl } from '@/lib/siteUrl'
import {
  STORE_ADDRESS,
  buildDirectionsUrl,
  buildMapEmbedUrl,
  buildWhatsappUrl,
} from '@/lib/storeLocation'
import { useOrgSettings } from '@/hooks/useOrgSettings'

const META_TITLE = 'Visitanos | Mates Ajedrez'
const META_DESCRIPTION = `Vení a conocer los mates en persona. Estamos en ${STORE_ADDRESS}.`

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 font-heading text-sm font-semibold uppercase tracking-[0.14em] transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg focus-visible:ring-brand-cuero'

export function Visitanos() {
  const settings = useOrgSettings()
  const whatsappUrl =
    buildWhatsappUrl(import.meta.env.VITE_SOCIAL_WHATSAPP) ?? buildWhatsappUrl(settings.store_whatsapp_number)

  return (
    <div className="container-custom py-8">
      <Helmet>
        <title>{META_TITLE}</title>
        <meta name="description" content={META_DESCRIPTION} />
        <meta property="og:title" content={META_TITLE} />
        <meta property="og:description" content={META_DESCRIPTION} />
        <meta property="og:url" content={absoluteUrl('/visitanos')} />
        <link rel="canonical" href={absoluteUrl('/visitanos')} />
      </Helmet>

      <div className="mb-8 pb-6 border-b border-brand-line">
        <p className="brand-eyebrow mb-2">Nuestro local</p>
        <h1 className="brand-title text-2xl md:text-3xl mb-1">Visitanos</h1>
        <p className="text-sm md:text-base text-brand-muted">
          Vení a conocer los mates en persona y llevate el tuyo.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-cuero" strokeWidth={1.5} aria-hidden="true" />
            <address className="not-italic text-brand-tinta">
              <span className="block font-heading text-[11px] font-semibold uppercase tracking-[0.28em] text-brand-algarrobo mb-1">
                Dirección
              </span>
              {STORE_ADDRESS}
            </address>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <a
              href={buildDirectionsUrl(STORE_ADDRESS)}
              target="_blank"
              rel="noopener noreferrer"
              className={`${BUTTON_BASE} bg-brand-cuero text-brand-crema hover:bg-brand-cuero-oscuro`}
            >
              <Navigation className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              Cómo llegar
            </a>
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${BUTTON_BASE} border border-brand-cuero bg-transparent text-brand-cuero hover:bg-brand-cuero hover:text-brand-crema`}
              >
                <MessageCircle className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                Escribinos por WhatsApp
              </a>
            )}
          </div>
        </div>

        <div className="aspect-[4/3] md:aspect-[16/9] w-full overflow-hidden rounded-md border border-brand-line bg-brand-crema">
          <iframe
            src={buildMapEmbedUrl(STORE_ADDRESS)}
            title={`Mapa de Google con la ubicación del local: ${STORE_ADDRESS}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-full w-full border-0"
          />
        </div>
      </div>
    </div>
  )
}
