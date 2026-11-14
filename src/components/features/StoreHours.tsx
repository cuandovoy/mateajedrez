import { Clock } from 'lucide-react'
import { STORE_HOURS, groupStoreHours } from '@/lib/storeHours'

export function StoreHours() {
  const groups = groupStoreHours(STORE_HOURS)

  return (
    <div className="flex items-start gap-3">
      <Clock className="mt-0.5 h-5 w-5 shrink-0 text-brand-cuero" strokeWidth={1.5} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <h2 className="mb-2 font-heading text-[11px] font-semibold uppercase tracking-[0.28em] text-brand-algarrobo">
          Horarios
        </h2>
        <dl className="space-y-1 text-sm text-brand-tinta">
          {groups.map((g) => (
            <div key={g.label} className="flex flex-col sm:flex-row sm:gap-3">
              <dt className="font-medium sm:w-36 sm:shrink-0">{g.label}</dt>
              <dd className="text-brand-muted">{g.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
