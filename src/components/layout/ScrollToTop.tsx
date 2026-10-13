import { useLayoutEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// BrowserRouter doesn't reset scroll on navigation, so new routes inherited the
// previous page's position. Back/forward (POP) is left to the browser, and URLs
// with a hash (e.g. "/#nosotros") are scrolled by the target page once loaded.
export function ScrollToTop() {
  const { pathname, hash } = useLocation()
  const navigationType = useNavigationType()

  useLayoutEffect(() => {
    if (navigationType === 'POP' || hash) return
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname, hash, navigationType])

  return null
}
