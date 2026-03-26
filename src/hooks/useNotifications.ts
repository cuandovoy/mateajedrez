import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { NotificationType } from '@/lib/notification-types'

export interface UserNotification {
  id: string
  org_id: string
  user_id: string | null
  type: NotificationType
  title: string
  body: string | null
  payload: Record<string, unknown>
  dedup_key: string | null
  read_at: string | null
  created_at: string
}

interface UseNotificationsOptions {
  orgId: string | null | undefined
  /** Cuántas notificaciones cargar inicialmente (default 20) */
  limit?: number
}

interface UseNotificationsReturn {
  notifications: UserNotification[]
  unreadCount: number
  loading: boolean
  markRead: (ids?: string[]) => Promise<void>
  markAllRead: () => Promise<void>
}

export function useNotifications({
  orgId,
  limit = 20,
}: UseNotificationsOptions): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [loading, setLoading] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const fetch = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('user_notifications')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit)
    setNotifications((data as UserNotification[]) ?? [])
    setLoading(false)
  }, [orgId, limit])

  // Carga inicial
  useEffect(() => {
    fetch()
  }, [fetch])

  // Suscripción Realtime — sin polling, push desde Supabase
  useEffect(() => {
    if (!orgId) return

    // Limpiar canal previo si cambia la org
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase
      .channel(`user_notifications:${orgId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          const newNotif = payload.new as UserNotification
          setNotifications((prev) => {
            // Evitar duplicados por si el evento llega dos veces
            if (prev.some((n) => n.id === newNotif.id)) return prev
            return [newNotif, ...prev].slice(0, limit)
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_notifications',
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          const updated = payload.new as UserNotification
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n))
          )
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [orgId, limit])

  const markRead = useCallback(
    async (ids?: string[]) => {
      if (!orgId) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).rpc('mark_notifications_read', {
        p_org_id: orgId,
        p_ids: ids ?? null,
      })
      // El UPDATE event del canal actualizará el estado vía Realtime,
      // pero forzamos local para respuesta inmediata
      setNotifications((prev) =>
        prev.map((n) =>
          !n.read_at && (!ids || ids.includes(n.id))
            ? { ...n, read_at: new Date().toISOString() }
            : n
        )
      )
    },
    [orgId]
  )

  const markAllRead = useCallback(() => markRead(undefined), [markRead])

  const unreadCount = notifications.filter((n) => !n.read_at).length

  return { notifications, unreadCount, loading, markRead, markAllRead }
}
