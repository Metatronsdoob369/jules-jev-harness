/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          deep: '#090B10',
          base: '#0D1117',
          deck: '#131923',
          bezel: '#161F2E',
          panel: '#1A2333',
        },
        optic: {
          cyan: '#00E5FF',
          bright: '#38BDF8',
          dim: '#084B63',
        },
        wal: {
          emerald: '#00FF88',
          muted: '#10B981',
        },
        drift: {
          amber: '#FFB020',
          muted: '#F59E0B',
        },
        fault: {
          crimson: '#EF4444',
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['"Space Grotesk"', 'sans-serif'],
        geist: ['Geist', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
