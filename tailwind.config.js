/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Cambria', 'Georgia', 'Times New Roman', 'serif'],
        heading: ['Bodoni Moda', 'serif'],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      colors: {
        // Paleta de marca (Ruemia) — derivada del ink de marca (#46362B, ver src/brand/).
        // Escala generada en OKLCH manteniendo hue/chroma constante (H≈56°); 900 es el
        // hex de marca real (#46362B). Contraste vs blanco verificado WCAG AA
        // (600: 6.06:1, 700: 8.55:1); 700 sobre 100/50 (Dropdown-style chips): 7.14:1 / 7.84:1.
        primary: {
          50: '#faf4f0',
          100: '#f2e9e3',
          200: '#e1d5cc',
          300: '#cabab0',
          400: '#ac9b8f',
          500: '#8f7c70',
          600: '#715f53',
          700: '#5a493e',
          800: '#4f3f33',
          900: '#46362b',
          DEFAULT: '#46362b',
        },
        // Tokens de marca crudos (ver docs de marca / branboard) — usar cuando se necesita
        // el hex exacto en vez de un paso de la escala `primary`.
        brand: {
          ink: '#46362B',
          camel: '#A78B6C',
          taupe: '#B29E88',
          cream: '#EAE2D6',
        },
      },
    },
  },
  plugins: [],
}
