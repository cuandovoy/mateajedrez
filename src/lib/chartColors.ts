/**
 * Paleta de colores para gráficos Recharts en el panel admin.
 *
 * Recharts requiere valores de color literales (hex/rgba) en sus props SVG
 * (`stroke`, `fill`, `tick.fill`, etc.) — no acepta clases de Tailwind. Este
 * archivo centraliza esos valores para que los gráficos usen los mismos
 * tokens de marca que el resto del panel admin (ver `tailwind.config.js`),
 * en vez de hex sueltos sin relación con la paleta (ej: el `#8F5F2C` que
 * usaba antes AdminStoreStats.tsx, sin vínculo con ningún token).
 *
 * No se mapea el rojo de acento (`accent`, `#fd2525`) a ninguna serie por
 * defecto: sirve para resaltar UNA serie puntual cuando tiene sentido
 * (ej. "este mes" vs. histórico), pero nunca para series que representen
 * pérdidas/valores negativos — ahí corresponde el rojo semántico estándar
 * (red-600), no el accent de marca, para no confundir "color de marca" con
 * "número malo".
 */
export const CHART_COLORS = {
  /** Serie principal de un gráfico (línea/área más relevante). Admin-600. */
  primary: '#646781',
  /** Variante más oscura del primario, para hover/énfasis. Admin-700. */
  primaryStrong: '#494b63',
  /**
   * Serie secundaria (métrica de comparación). Emerald-500 — distinto del
   * primario y sin connotación de error/pérdida.
   */
  secondary: '#10b981',
  /** Líneas de grilla (CartesianGrid). Gray-100. */
  grid: '#f1f5f9',
  /** Ejes y ticks (XAxis/YAxis). Gray-400. */
  axis: '#9ca3af',
  /** Línea guía del cursor al hacer hover sobre el gráfico. Admin-300. */
  cursorLine: '#c0c2d7',
  /** Borde del tooltip. Gray-200. */
  tooltipBorder: '#e5e7eb',
  /** Texto del label del tooltip (encabezado). Gray-700. */
  tooltipLabel: '#374151',
  /** Texto de los valores dentro del tooltip. Gray-500. */
  tooltipItem: '#6b7280',
} as const

/** Sombra sutil del tooltip, derivada del primario (admin-600 en rgba). */
export const CHART_TOOLTIP_SHADOW = '0 4px 16px rgba(100, 103, 129, 0.12)'
