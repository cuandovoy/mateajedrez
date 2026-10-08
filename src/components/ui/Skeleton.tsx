import { cn } from '@/lib/utils'

type Props = {
  className?: string
}

export function Skeleton({ className }: Props) {
  return (
    <div
      className={cn('brand-shimmer rounded', className)}
      aria-hidden
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-brand-line bg-white p-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonProductCard() {
  return (
    <div className="rounded-lg border border-brand-line bg-white overflow-hidden">
      <Skeleton className="w-full aspect-square rounded-none" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="pt-1">
          <Skeleton className="h-5 w-24" />
        </div>
      </div>
    </div>
  )
}

// Placeholder de página completa — usado antes de que exista la organización
// (bootstrap inicial de la tienda pública), cuando todavía no hay layout real
// que envolver con Skeleton*/EmptyState comunes. Aproxima header + hero + grid.
export function SkeletonFullPage() {
  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="h-16 lg:h-20 border-b border-brand-line flex items-center">
        <div className="container-custom flex items-center justify-between">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="hidden lg:flex gap-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        </div>
      </div>
      <Skeleton className="w-full h-64 md:h-96 rounded-none" />
      <div className="container-custom py-12">
        <Skeleton className="h-8 w-40 mx-auto mb-10 rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <SkeletonProductCard key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        <div className="flex gap-4 border-b border-brand-line pb-3 mb-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-4 border-b border-brand-line">
            <Skeleton className="h-12 w-12 rounded" />
            <Skeleton className="h-4 flex-1 max-w-[200px]" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-20 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
