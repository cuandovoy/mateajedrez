import { useEffect, useRef, useState } from 'react'
import { Bell, ShoppingCart, AlertTriangle, RefreshCw, Check, CheckCheck, X } from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'
import { NOTIFICATION_TYPES } from '@/lib/notification-types'
import type { UserNotification } from '@/hooks/useNotifications'
import type { NotificationType } from '@/lib/notification-types'
import { cn } from '@/lib/utils'

// Mapa de íconos por nombre de lucide-react
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  ShoppingCart,
  AlertTriangle,
  RefreshCw,
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  return `hace ${days}d`
}

function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: UserNotification
  onMarkRead: (id: string) => void
}) {
  const typeConfig = NOTIFICATION_TYPES.find((t) => t.type === (notification.type as NotificationType))
  const Icon = typeConfig ? (ICON_MAP[typeConfig.icon] ?? Bell) : Bell
  const isUnread = !notification.read_at

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 transition-colors group',
        isUnread ? 'bg-admin-50/60 hover:bg-admin-50' : 'hover:bg-gray-50'
      )}
    >
      {/* Ícono del tipo */}
      <div
        className={cn(
          'mt-0.5 h-8 w-8 rounded-full flex items-center justify-center shrink-0',
          isUnread ? 'bg-white shadow-sm' : 'bg-gray-100'
        )}
      >
        <Icon
          className={cn(
            'h-4 w-4',
            typeConfig?.color ?? 'text-gray-400'
          )}
        />
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm leading-snug truncate',
            isUnread ? 'font-medium text-gray-900' : 'text-gray-700'
          )}
        >
          {notification.title}
        </p>
        {notification.body && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">{notification.body}</p>
        )}
        <p className="text-[10px] text-gray-400 mt-1">
          {formatRelativeTime(notification.created_at)}
        </p>
      </div>

      {/* Punto de no leída + botón marcar */}
      <div className="flex items-center gap-1 shrink-0">
        {isUnread && (
          <>
            <span className="h-2 w-2 rounded-full bg-admin-500 group-hover:hidden" />
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMarkRead(notification.id)
              }}
              className="hidden group-hover:flex h-6 w-6 items-center justify-center rounded-full hover:bg-gray-200 transition-colors"
              title="Marcar como leída"
            >
              <Check className="h-3.5 w-3.5 text-gray-500" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

interface Props {
  orgId: string | null | undefined
}

export function NotificationBell({ orgId }: Props) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications({ orgId })

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botón campanita */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative p-1.5 rounded-md transition-colors',
          open
            ? 'bg-admin-50 text-admin-600'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
        )}
        title="Notificaciones"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[1rem] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-1 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-800">Notificaciones</span>
              {unreadCount > 0 && (
                <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-admin-100 text-admin-700">
                  {unreadCount} nueva{unreadCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-admin-600 hover:text-admin-700 px-2 py-1 rounded hover:bg-admin-50 transition-colors"
                  title="Marcar todas como leídas"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Leer todas</span>
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Lista */}
          <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-100">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-admin-600" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
                <Bell className="h-8 w-8 opacity-30" />
                <p className="text-sm">Sin notificaciones</p>
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onMarkRead={(id) => markRead([id])}
                />
              ))
            )}
          </div>

          {/* Footer — solo si hay notificaciones leídas */}
          {notifications.some((n) => n.read_at) && (
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
              <p className="text-[10px] text-gray-400 text-center">
                Mostrando las últimas {notifications.length} notificaciones
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
