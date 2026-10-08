import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { buildWhatsappUrl } from '@/lib/storeLocation'

interface HomePhotoProps {
  name: string
  alt: string
  className?: string
  sizes?: string
  priority?: boolean
}

export function HomePhoto({ name, alt, className = '', sizes = '(min-width: 768px) 50vw, 100vw', priority = false }: HomePhotoProps) {
  const isSmallOriginal = name === 'mates-para-compartir'

  return (
    <img
      src={`/images/home/${name}-960.webp`}
      srcSet={isSmallOriginal ? undefined : `/images/home/${name}-480.webp 480w, /images/home/${name}-960.webp 960w`}
      sizes={sizes}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      {...(priority ? { fetchpriority: 'high' } : {})}
      decoding="async"
      className={`h-full w-full object-cover ${className}`}
    />
  )
}

export function HomePhotoHero() {
  return (
    <section aria-labelledby="home-title" className="border-b border-brand-line bg-brand-crema">
      <div className="container-custom grid md:grid-cols-2 gap-7 md:gap-10 lg:gap-16 items-center py-7 md:py-12">
        <div className="md:py-8">
          <h1 id="home-title" className="brand-title text-4xl sm:text-5xl md:text-4xl lg:text-6xl !leading-[1.15] !tracking-[0.06em] max-w-lg">
            Tu mate,<br />tu momento.
          </h1>
          <p className="text-brand-muted text-base md:text-lg leading-relaxed max-w-md mt-5">
            Mates artesanales para tu ritual de todos los días. Elegí el tuyo y dale un detalle personal.
          </p>
          <Link to="/products" className="inline-flex min-h-12 items-center gap-4 bg-brand-cuero text-brand-crema px-6 mt-6 font-heading text-sm uppercase tracking-widest hover:bg-brand-cuero-oscuro transition-colors focus-ring">
            Ver mates <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <a href="#personalizados" className="w-fit mt-2 md:mt-3 min-h-11 flex items-center text-sm text-brand-cuero underline underline-offset-4 hover:text-brand-tinta focus-ring">
            Ver regalos personalizados
          </a>
        </div>
        <div className="relative pb-7 pr-10 md:pr-12">
          <div className="aspect-[4/5] max-h-[570px] overflow-hidden">
            <HomePhoto name="ritual-matero" alt="Un momento de mate entre las manos, con virola personalizada con el nombre Coty" priority sizes="(min-width: 1280px) 520px, (min-width: 768px) 45vw, 90vw" />
          </div>
          <div className="absolute bottom-0 right-0 w-[36%] aspect-[4/5] border-[6px] border-brand-crema">
            <HomePhoto name="detalles-personalizados" alt="Detalles de virolas con flores, iniciales y apliques personalizados" sizes="(min-width: 1280px) 190px, (min-width: 768px) 18vw, 32vw" />
          </div>
        </div>
      </div>
    </section>
  )
}

const workPhotos = [
  { name: 'mate-con-tu-marca', alt: 'Mate de calabaza grabado con el logo de SSA', caption: 'SSA · Grabado en calabaza' },
  { name: 'mates-para-compartir', alt: 'Canasta de mates personalizados para Eugenia Fernández', caption: 'Eugenia Fernández · Mates con logo' },
  { name: 'mates-bwo', alt: 'Mates de calabaza con grabado del logo de BWO', caption: 'BWO · Regalos de empresa' },
  { name: 'mates-genolet', alt: 'Canasta de mates grabados para Genolet Transporte', caption: 'Genolet · Mates personalizados' },
]

export function HomePersonalization() {
  const whatsappUrl = buildWhatsappUrl(import.meta.env.VITE_SOCIAL_WHATSAPP)

  return (
    <section id="personalizados" aria-labelledby="personalizados-title" className="scroll-mt-24 py-12 md:py-20">
      <div className="container-custom">
        <div className="grid md:grid-cols-2 items-center gap-8 lg:gap-16">
          <div className="order-2 md:order-1 aspect-[4/5] md:aspect-square overflow-hidden">
            <HomePhoto name="regalo-personalizado" alt="Mate grabado para Eugenia Fernández en una caja de regalo, junto a otros mates personalizados" className="object-[center_65%]" />
          </div>
          <div className="order-1 md:order-2 max-w-lg">
            <h2 id="personalizados-title" className="brand-title text-3xl lg:text-4xl !leading-tight">Regalá algo<br />personal.</h2>
            <p className="mt-6 text-brand-muted text-lg leading-relaxed">
              Un nombre para alguien especial. El logo de tu empresa para tu equipo. Personalizamos cada mate con grabados y detalles que hacen la diferencia.
            </p>
            {whatsappUrl ? (
              <a href={`${whatsappUrl}?text=${encodeURIComponent('¡Hola! Me gustaría consultar por mates personalizados.')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 min-h-12 mt-7 border-b border-brand-cuero font-heading text-sm uppercase tracking-widest text-brand-cuero hover:text-brand-tinta focus-ring">
                Consultar por WhatsApp <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            ) : (
              <Link to="/visitanos" className="inline-flex items-center gap-3 min-h-12 mt-7 border-b border-brand-cuero font-heading text-sm uppercase tracking-widest text-brand-cuero hover:text-brand-tinta focus-ring">
                Consultá en el local <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
        <div className="mt-12 md:mt-16">
          <h3 className="font-heading text-xl md:text-2xl text-brand-tinta mb-5">Algunos trabajos que ya entregamos</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-7 md:gap-x-6">
            {workPhotos.map((photo) => (
              <figure key={photo.name}>
                <div className="aspect-[4/5] overflow-hidden">
                  <HomePhoto name={photo.name} alt={photo.alt} sizes="(min-width: 1280px) 280px, (min-width: 1024px) 25vw, 50vw" />
                </div>
                <figcaption className="mt-3 text-sm text-brand-muted">{photo.caption}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
