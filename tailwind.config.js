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
          50: '#f5f0f9',
          100: '#e8ddf0',
          200: '#d4bddb',
          300: '#b895c3',
          400: '#9d6fa8',
          500: '#85508f',
          600: '#6d3f75',
          700: '#5a3360',
          800: '#4a2a4f',
          900: '#3d2341',
          DEFAULT: '#d4bddb',
        },
        // Paleta de colores para Admin Panel (azul profesional)
        admin: {
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
        warm: {
          50: '#fef7f0',
          100: '#fdeee0',
          200: '#fbd9c0',
          300: '#f8be96',
          400: '#f49a6a',
          500: '#f17a45',
          600: '#e25d2e',
          700: '#bb4824',
          800: '#973b22',
          900: '#7a331f',
        },
      },
    },
  },
  plugins: [],
}
