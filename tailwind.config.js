/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Source Sans 3"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        heading: ['"Josefin Sans"', '"Source Sans 3"', 'system-ui', 'sans-serif'],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      colors: {
        // Paleta de marca (Mates Ajedrez) — escala derivada del Cuero (#705931, paso 600).
        // Contraste vs blanco: 600 ≈ 6.6:1 (AA); 700 y superiores más altos.
        primary: {
          50: '#f7f4e9',
          100: '#ede6d1',
          200: '#dccfae',
          300: '#c5b284',
          400: '#a9875a',
          500: '#8b7143',
          600: '#705931',
          700: '#5a4626',
          800: '#43341c',
          900: '#2b2418',
          DEFAULT: '#705931',
        },
        // Tokens de marca crudos (manual de marca) — usar cuando se necesita
        // el hex exacto en vez de un paso de la escala `primary`.
        brand: {
          cuero: '#705931',
          crema: '#F7F4E9',
          'cuero-oscuro': '#5A4626',
          algarrobo: '#A9875A',
          yerba: '#5E7A3A',
          tinta: '#2B2418',
        },
      },
    },
  },
  plugins: [],
}
