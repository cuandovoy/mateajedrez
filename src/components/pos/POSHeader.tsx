import { cn } from '@/lib/utils'
import { ArrowLeft, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'

interface POSHeaderProps {
  branchName: string
  hasOpenSession: boolean
  itemCount: number
}

export function POSHeader({ branchName, hasOpenSession, itemCount }: POSHeaderProps) {
  return (
    <header className="bg-[#1c1d33] sticky top-0 z-20 px-4 h-14 flex items-center justify-between flex-shrink-0">
      <Link
        to="/pos"
        className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm transition-colors min-w-0"
      >
        <ArrowLeft className="h-4 w-4 flex-shrink-0" />
        <span className="hidden sm:inline">Sucursales</span>
      </Link>

      <div className="flex flex-col items-center min-w-0 px-2">
        <span className="text-white font-semibold text-sm truncate max-w-[160px] sm:max-w-xs">
          {branchName}
        </span>
        <span
          className={cn(
            'text-[10px] font-medium flex items-center gap-1',
            hasOpenSession ? 'text-green-400' : 'text-white/40'
          )}
        >
          {hasOpenSession && <Zap className="h-2.5 w-2.5" />}
          {hasOpenSession ? 'Caja abierta' : 'Sin caja'}
        </span>
      </div>

      {/* Placeholder para mantener el centrado */}
      <div className="w-16 flex justify-end">
        {itemCount > 0 && (
          <span className="h-5 w-5 rounded-full bg-admin-500 text-white text-[10px] font-bold flex items-center justify-center">
            {itemCount > 99 ? '99+' : itemCount}
          </span>
        )}
      </div>
    </header>
  )
}
