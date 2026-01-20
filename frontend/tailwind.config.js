/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'midnight': {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98',
          600: '#486581',
          700: '#334e68',
          800: '#243b53',
          900: '#102a43',
          950: '#0a1929'
        },
        'accent': {
          50: '#eef8ff',
          100: '#d8eeff',
          200: '#b9e2ff',
          300: '#89d2ff',
          400: '#52b8ff',
          500: '#2a97ff',
          600: '#1478ff',
          700: '#0d5feb',
          800: '#124dbe',
          900: '#154495',
          950: '#122a5a'
        },
        'gain': '#10b981',
        'loss': '#ef4444',
        'warning': '#f59e0b'
      },
      fontFamily: {
        'display': ['Outfit', 'system-ui', 'sans-serif'],
        'body': ['DM Sans', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace']
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'mesh-gradient': 'linear-gradient(135deg, #0a1929 0%, #102a43 50%, #1a365d 100%)',
        'glow': 'radial-gradient(ellipse at center, rgba(42, 151, 255, 0.15) 0%, transparent 70%)'
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate'
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(42, 151, 255, 0.3)' },
          '100%': { boxShadow: '0 0 40px rgba(42, 151, 255, 0.6)' }
        }
      }
    },
  },
  plugins: [],
}
