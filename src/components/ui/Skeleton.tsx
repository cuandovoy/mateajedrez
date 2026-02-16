import { cn } from '@/lib/utils'

type Props = {
  className?: string
}

export function Skeleton({ className }: Props) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-gray-200', className)}
      aria-hidden
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
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

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        <div className="flex gap-4 border-b border-gray-200 pb-3 mb-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-4 border-b border-gray-100">
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
