/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          900: '#080a0f',
          850: '#0c0f17',
          800: '#121622',
          750: '#171c2b',
          700: '#1e2436',
          600: '#2a324b',
        },
        accent: {
          amber: '#f59e0b',
          cyan: '#06b6d4',
          rose: '#f43f5e',
          violet: '#8b5cf6',
          emerald: '#10b981',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
