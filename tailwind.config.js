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
          bg: '#FBF9F3',
          line: '#E4DCC8',
          muted: '#6E634F',
        },
      },
      keyframes: {
        'brand-ring-draw': {
          '0%': { strokeDashoffset: '302' },
          '70%, 100%': { strokeDashoffset: '0' },
        },
        'brand-seal-breathe': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.035)' },
        },
        'brand-fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'brand-shimmer': {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        'brand-ring-draw': 'brand-ring-draw 2.4s cubic-bezier(0.25, 1, 0.5, 1) infinite',
        'brand-seal-breathe': 'brand-seal-breathe 3.2s ease-in-out infinite',
        'brand-fade-in': 'brand-fade-in 0.9s cubic-bezier(0.25, 1, 0.5, 1) 0.3s both',
        'brand-shimmer': 'brand-shimmer 1.8s linear infinite',
      },
    },
  },
  plugins: [],
}
