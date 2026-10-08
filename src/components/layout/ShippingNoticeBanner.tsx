import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { STORE_ADDRESS } from '@/lib/storeLocation'

export function ShippingNoticeBanner() {
  return (
    <div className="w-full bg-brand-cuero px-4 py-2 text-center text-brand-crema">
      <Link to="/visitanos" className="container-custom flex items-center justify-center gap-2 hover:underline underline-offset-4 focus-ring">
        <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
        <span className="font-heading text-[11px] font-semibold uppercase tracking-[0.18em] sm:text-xs">
          {STORE_ADDRESS}
        </span>
      </Link>
    </div>
  )
}
