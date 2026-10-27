/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#060B14',
          900: '#0B1120',
          800: '#0F172A',
          700: '#1E293B',
          600: '#334155',
        },
        energy: {
          green: '#10B981',
          teal: '#14B8A6',
          blue: '#3B82F6',
          amber: '#F59E0B',
          red: '#EF4444',
          purple: '#8B5CF6',
        }
      }
    },
  },
  plugins: [],
}
