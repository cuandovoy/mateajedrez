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
      <div className="container-custom grid gap-7 py-8 md:grid-cols-2 md:grid-rows-[1fr_auto] md:gap-x-12 md:gap-y-8 md:py-12 lg:gap-x-20">
        <div className="text-center md:text-left md:self-end md:pt-6">
          <img src="/images/logo-ajedrez-cuero.png" alt="Mates Ajedrez" width={188} height={200} className="hidden lg:block mb-8 h-40 w-auto xl:h-48" />
          <h1 id="home-title" className="font-heading font-normal text-brand-tinta text-[2.75rem] leading-[1.05] tracking-[-0.02em] sm:text-6xl lg:text-7xl">
            Tu mate,<br /><span className="text-brand-cuero">tu momento.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-sm text-base leading-relaxed text-brand-tinta md:mx-0 md:mt-6 md:text-lg">
            Mates artesanales para tu ritual de todos los días. Elegí el tuyo y dale un detalle personal.
          </p>
          <Link to="/products" className="mt-6 inline-flex min-h-12 items-center justify-center gap-5 bg-brand-cuero px-7 py-3 font-heading text-sm font-semibold text-brand-crema hover:bg-brand-cuero-oscuro transition-colors focus-ring md:mt-8">
            Ver mates <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="mx-auto w-full max-w-sm md:col-start-2 md:row-start-1 md:row-span-2 md:mr-0 md:max-w-[85%] md:self-center">
          <HomePhoto name="mate-bryan-portada" alt="Mate artesanal con virola cincelada y el nombre Bryan, sobre una tela junto a una piel clara" className="!h-auto !object-contain" priority sizes="(min-width: 1280px) 483px, (min-width: 768px) 38vw, (min-width: 416px) 384px, calc(100vw - 32px)" />
        </div>
        <a href="#personalizados" className="group mx-auto flex w-full max-w-sm items-center gap-5 border-t border-brand-line pt-5 text-brand-tinta focus-ring md:mx-0 md:col-start-1 md:row-start-2 md:mb-6 md:pt-6">
          <span className="block aspect-square w-20 shrink-0 overflow-hidden md:w-24">
            <HomePhoto name="detalles-personalizados" alt="Detalles de virolas con flores, iniciales y apliques personalizados" sizes="(min-width: 768px) 96px, 80px" />
          </span>
          <span className="flex-1 font-heading text-base leading-snug underline decoration-brand-cuero/40 underline-offset-4 group-hover:decoration-brand-cuero">Ver regalos personalizados</span>
          <ArrowRight className="h-5 w-5 shrink-0 text-brand-cuero transition-transform group-hover:translate-x-1 motion-reduce:transform-none" aria-hidden="true" />
        </a>
      </div>
    </section>
  )
}

const workPhotos = [
  { name: 'mate-con-tu-marca', alt: 'Mate de calabaza grabado con el logo de SSA', caption: 'SSA · Grabado en calabaza' },
  { name: 'mates-para-compartir', alt: 'Canasta de mates personalizados para Eugenia Fernández', caption: 'Eugenia Fernández · Mates con logo' },
  { name: 'mates-bwo', alt: 'Mates de calabaza con grabado del logo de BWO', caption: 'BWO · Regalos de empresa' },
  { name: 'mates-genolet', alt: 'Canasta de mates grabados para Genolet Transporte', caption: 'Genolet · Mates personalizados' },
  { name: 'mates-congreso-salto', alt: 'Mate de cuero grabado del Congreso 2025 Ser-con-cáncer, Salto, levantado frente a muchos otros mates', caption: 'Congreso Ser-con-cáncer · Salto 2025' },
  { name: 'mate-iniciales', alt: 'Mate de madera con las iniciales L∞A aplicadas en plata, sostenido en la mano', caption: 'Iniciales L∞A · Aplique en plata' },
  { name: 'virola-cincelada', alt: 'Vista superior de una virola de plata cincelada con hojas y el nombre Bryan', caption: 'Bryan · Virola cincelada' },
  { name: 'mates-residencia-san-cono', alt: 'Mates de calabaza y portamates de cuero apilados, grabados con el logo de Residencia San Cono', caption: 'Residencia San Cono · Mate y portamate grabados' },
]

const sharedPhotos = [
  { name: 'mate-entre-amigas', alt: 'Dos amigas sentadas en un banco de plaza compartiendo mate con un termo' },
  { name: 'cebando-mate', alt: 'Una mujer vertiendo agua del termo en un mate' },
  { name: 'mate-al-sol', alt: 'Un mate con bombilla sobre una mesa de jardín de hierro forjado, bajo el sol' },
]

export function HomeLifestyle() {
  return (
    <section aria-labelledby="lifestyle-title" className="py-12 md:py-20 border-b border-brand-line">
      <div className="container-custom">
        <div className="max-w-lg mb-8 md:mb-10">
          <h2 id="lifestyle-title" className="brand-title text-3xl lg:text-4xl !leading-tight">Para compartir.</h2>
          <p className="mt-5 text-brand-muted text-lg leading-relaxed">
            El mate se disfruta mejor en compañía: en la plaza, en el jardín o en cualquier pausa del día.
          </p>
        </div>
        <div className="grid grid-cols-2 grid-rows-2 aspect-[6/5] md:aspect-auto md:grid-cols-3 md:grid-rows-1 gap-3 md:gap-6">
          {sharedPhotos.map((photo, index) => (
            <div key={photo.name} className={`min-h-0 min-w-0 overflow-hidden rounded-md md:aspect-[4/5] ${index === 0 ? 'row-span-2 md:row-span-1' : ''}`}>
              <HomePhoto name={photo.name} alt={photo.alt} className={index === 1 ? 'object-[center_30%] md:object-center' : ''} sizes="(min-width: 1280px) 400px, (min-width: 768px) 30vw, 45vw" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

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
          <h3 id="work-gallery-title" className="font-heading text-xl md:text-2xl text-brand-tinta mb-3 md:mb-5">Algunos trabajos que ya entregamos</h3>
          <p id="work-gallery-hint" className="text-sm text-brand-muted mb-4 md:hidden">Deslizá para ver más trabajos.</p>
          <div role="region" aria-labelledby="work-gallery-title" aria-describedby="work-gallery-hint" tabIndex={0} className="grid grid-flow-col auto-cols-[46%] gap-3 overflow-x-auto snap-x snap-mandatory pb-3 focus-ring md:grid-flow-row md:auto-cols-auto md:grid-cols-2 lg:grid-cols-4 md:gap-x-6 md:gap-y-7 md:overflow-visible md:pb-0">
            {workPhotos.map((photo) => (
              <figure key={photo.name} className="min-w-0 snap-start">
                <div className="aspect-square md:aspect-[4/5] overflow-hidden">
                  <HomePhoto name={photo.name} alt={photo.alt} sizes="(min-width: 1280px) 280px, (min-width: 1024px) 25vw, (min-width: 768px) 50vw, 45vw" />
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
