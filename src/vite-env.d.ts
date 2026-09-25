/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_APP_URL?: string
  /** Dominio canónico absoluto del sitio (ej: https://ruemia.uy), usado para canonical/og:url y el sitemap. Si está vacío, se usa el fallback DEFAULT_SITE_URL de src/lib/siteUrl.ts. */
  readonly VITE_SITE_URL?: string
  /** URL completa del perfil de Instagram (ej: https://instagram.com/ruemia). Si está vacía, el ícono no se muestra. */
  readonly VITE_SOCIAL_INSTAGRAM?: string
  /** URL completa de la página de Facebook. Si está vacía, el ícono no se muestra. */
  readonly VITE_SOCIAL_FACEBOOK?: string
  /** Número de WhatsApp (mismo formato que organization.settings.store_whatsapp_number). Si está vacío, el ícono no se muestra. */
  readonly VITE_SOCIAL_WHATSAPP?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
