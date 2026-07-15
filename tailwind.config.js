/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      colors: {
        primary: {
           50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          DEFAULT: '#3b82f6',
        },
        // Paleta de colores para Admin Panel — derivada del navy de marca (#1c1d33, ver docs/product_marketing.md)
        // Escala generada en OKLCH manteniendo hue/chroma constante; contraste vs blanco verificado WCAG AA (600: 5.53:1, 700: 8.50:1, 800: 12.76:1)
        admin: {
          50: '#f7f8ff',
          100: '#eceef8',
          200: '#dbddec',
          300: '#c0c2d7',
          400: '#a0a3bb',
          500: '#81849f',
          600: '#646781',
          700: '#494b63',
          800: '#2f3145',
          900: '#1c1d33',
          950: '#0b0c17',
          DEFAULT: '#646781',
        },
        // Acento de marca — derivado del rojo (#fd2525). Uso puntual (badges, highlights), nunca en botones/focus-rings
        // generales ni en estados con semántica propia (error/destructivo siguen usando la escala red/rose estándar).
        accent: {
          50: '#ffeae2',
          100: '#ffd9cf',
          200: '#ffbeb1',
          300: '#ff9484',
          400: '#ff6356',
          500: '#fd2525',
          600: '#d20000',
          700: '#a90000',
          800: '#7d0000',
          900: '#570000',
          DEFAULT: '#fd2525',
        },
      },
    },
  },
  plugins: [],
}
