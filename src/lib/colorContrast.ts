/**
 * Cada organización elige su propio color de marca (primary/secondary/accent),
 * y ese color se usa como fondo de botones, chips activos y CTAs en la tienda
 * pública. Un texto blanco fijo sobre ese fondo se vuelve invisible cuando la
 * organización elige un color claro/pastel. Este módulo calcula, para un color
 * de fondo dado, si texto blanco o texto oscuro da mejor contraste (WCAG),
 * para usarse como el valor de una CSS var `--org-*-ink` inyectada junto al
 * color de fondo (ver src/components/layout/PublicStoreLayout.tsx).
 */

const HEX_RE = /^#([0-9a-fA-F]{6})$/

const WHITE_INK = '#ffffff'
const DARK_INK = '#111827' // gray-900, más legible que negro puro sobre fondos saturados

function hexToRgb(hex: string): [number, number, number] | null {
  const match = HEX_RE.exec(hex)
  if (!match) return null
  const int = parseInt(match[1], 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rl, gl, bl] = [r, g, b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl
}

function contrastRatio(l1: number, l2: number): number {
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Devuelve el color de texto (blanco o tinta oscura) con mejor contraste
 * WCAG sobre el color de fondo dado. Si `bgHex` no es un hex de 6 dígitos
 * válido, devuelve blanco (comportamiento histórico, no empeora nada).
 */
export function getReadableTextColor(bgHex: string | null | undefined): string {
  const rgb = bgHex ? hexToRgb(bgHex) : null
  if (!rgb) return WHITE_INK

  const bgLuminance = relativeLuminance(rgb)
  const whiteLuminance = 1
  const darkLuminance = relativeLuminance(hexToRgb(DARK_INK) as [number, number, number])

  const contrastWithWhite = contrastRatio(bgLuminance, whiteLuminance)
  const contrastWithDark = contrastRatio(bgLuminance, darkLuminance)

  return contrastWithWhite >= contrastWithDark ? WHITE_INK : DARK_INK
}
