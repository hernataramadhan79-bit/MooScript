/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#09090b',
        surface: '#0e0e12',
        'surface-container-lowest': '#050507',
        'surface-container-low': '#121217',
        'surface-container': '#181820',
        'surface-container-high': '#20202a',
        'surface-container-highest': '#2a2a36',
        primary: '#9ee939',
        'primary-fixed': '#acf847',
        'primary-container': '#84cc16',
        'on-primary': '#132300',
        'on-surface': '#f4f4f5',
        'on-surface-variant': '#a1a1aa',
        outline: '#3f3f46',
        'outline-variant': '#27272a',
        secondary: '#4ae176',
        tertiary: '#ffcb8d',
        accent: {
          lime: '#9ee939',
          cyan: '#38bdf8',
          amber: '#f59e0b',
          rose: '#fb7185',
          violet: '#a855f7'
        }
      },
      boxShadow: {
        glow: '0 0 25px rgba(158, 233, 57, 0.25)',
        'glow-sm': '0 0 12px rgba(158, 233, 57, 0.2)',
        'glow-cyan': '0 0 20px rgba(56, 189, 248, 0.2)'
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      }
    }
  },
  plugins: []
};
