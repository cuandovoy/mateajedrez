import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

const SESSION_KEY = 'axios_store_session'

function getOrCreateSessionId(): string {
  try {
    let sid = sessionStorage.getItem(SESSION_KEY)
    if (!sid) {
      sid = crypto.randomUUID()
      sessionStorage.setItem(SESSION_KEY, sid)
    }
    return sid
  } catch {
    return crypto.randomUUID()
  }
}

function detectDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const ua = navigator.userAgent
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet'
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile'
  return 'desktop'
}

export function usePageViewTracker(organizationId: string | undefined, slug: string | undefined) {
  const location = useLocation()

  useEffect(() => {
    if (!organizationId || !slug) return

    const sessionId = getOrCreateSessionId()
    const deviceType = detectDeviceType()
    const referrer = document.referrer || null

    supabase
      .from('store_page_views' as any)
      .insert({
        organization_id: organizationId,
        slug,
        page_path: location.pathname,
        session_id: sessionId,
        device_type: deviceType,
        referrer,
      })
      .then(({ error }) => {
        if (error) console.error('[PageView]', error.message)
      })
  }, [organizationId, slug, location.pathname])
}
