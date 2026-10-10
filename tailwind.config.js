/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  safelist: [
    'bg-accent',
    'text-accent',
    'text-on-accent',
    'text-text-muted',
    'border-accent',
    'ring-accent'
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--bg)',
        surface: 'var(--surface-1)',
        'surface-1': 'var(--surface-1)',
        'surface-2': 'var(--surface-2)',
        'surface-3': 'var(--surface-3)',
        'surface-hover': 'var(--surface-hover)',
        'surface-container-lowest': '#050507',
        'surface-container-low': 'var(--surface-1)',
        'surface-container': 'var(--surface-2)',
        'surface-container-high': 'var(--surface-3)',
        'surface-container-highest': 'var(--surface-hover)',
        primary: 'var(--accent)',
        'primary-fixed': 'var(--accent-hover)',
        'primary-container': 'var(--accent)',
        'on-primary': 'var(--on-accent)',
        'on-surface': 'var(--text)',
        'on-surface-variant': 'var(--text-muted)',
        outline: 'var(--border)',
        'outline-variant': 'var(--border-subtle)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        'on-accent': 'var(--on-accent)',
        'text-muted': 'var(--text-muted)',
        'text-faint': 'var(--text-faint)',
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          muted: 'var(--accent-muted)',
          danger: 'var(--danger)',
          warning: 'var(--warning)',
          success: 'var(--success)',
          lime: 'var(--accent)'
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      minHeight: {
        tap: 'var(--tap)'
      },
      minWidth: {
        tap: 'var(--tap)'
      }
    }
  },
  plugins: []
};
