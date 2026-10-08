import { Truck } from 'lucide-react'

export function ShippingNoticeBanner() {
  return (
    <div
      className="w-full py-2 px-4 text-center text-white"
      style={{ backgroundColor: '#5A4626' }}
    >
      <div className="container-custom flex items-center justify-center gap-2">
        <Truck className="h-4 w-4 shrink-0" />
        <span className="text-xs sm:text-sm font-medium">
          Los productos tienen una demora de entrega de 3 a 5 días hábiles.
        </span>
      </div>
    </div>
  )
}
