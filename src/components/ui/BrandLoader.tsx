import logoSquare from '@/brand/mates-ajedrez-logo-square.jpeg'

interface BrandLoaderProps {
  /** Accessible status text announced to screen readers. */
  label?: string
}

// Full-screen branded loader: the logo as a circular seal with a thin ring drawing
// around it, and the spaced wordmark fading in below. Ring is SVG + CSS (see tailwind keyframes).
export function BrandLoader({ label = 'Cargando la tienda' }: BrandLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-brand-bg"
    >
      <div className="relative h-28 w-28">
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={logoSquare}
            alt=""
            width={80}
            height={80}
            decoding="async"
            className="brand-loader-seal animate-brand-seal-breathe h-20 w-20 rounded-full object-cover"
          />
        </div>
        <svg viewBox="0 0 112 112" className="absolute inset-0 h-full w-full" fill="none" aria-hidden="true">
          <circle
            className="brand-loader-ring animate-brand-ring-draw"
            cx="56"
            cy="56"
            r="48"
            stroke="#A9875A"
            strokeWidth="1"
            strokeLinecap="round"
            strokeDasharray="302"
            transform="rotate(-90 56 56)"
          />
        </svg>
      </div>
      <p className="brand-loader-word animate-brand-fade-in font-heading text-lg font-light uppercase tracking-[0.5em] text-brand-cuero pl-[0.5em]">
        Ajedrez
      </p>
      <span className="sr-only">{label}</span>
    </div>
  )
}
