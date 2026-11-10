/**
 * A design token as a Tailwind colour that accepts an opacity modifier (bg-accent/15, border-border/60).
 * A bare var() cannot take one: Tailwind then emits no rule at all, and a border falls back to the
 * browser's light default colour.
 */
const token = (name) => `color-mix(in srgb, var(${name}) calc(<alpha-value> * 100%), transparent)`;

/** @type {import('tailwindcss').Config} */
export default {
  // Resolved from this file, not the working directory, so Vite can be started from the repo root.
  content: { relative: true, files: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'] },
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
        background: token('--bg'),
        surface: token('--surface-1'),
        'surface-1': token('--surface-1'),
        'surface-2': token('--surface-2'),
        'surface-3': token('--surface-3'),
        'surface-hover': token('--surface-hover'),
        'surface-container-lowest': '#050507',
        'surface-container-low': token('--surface-1'),
        'surface-container': token('--surface-2'),
        'surface-container-high': token('--surface-3'),
        'surface-container-highest': token('--surface-hover'),
        primary: token('--accent'),
        'primary-fixed': token('--accent-hover'),
        'primary-container': token('--accent'),
        'on-primary': token('--on-accent'),
        'on-surface': token('--text'),
        'on-surface-variant': token('--text-muted'),
        outline: token('--border'),
        'outline-variant': token('--border-subtle'),
        border: token('--border'),
        'border-strong': token('--border-strong'),
        'on-accent': token('--on-accent'),
        'text-muted': token('--text-muted'),
        'text-faint': token('--text-faint'),
        accent: {
          DEFAULT: token('--accent'),
          hover: token('--accent-hover'),
          muted: token('--accent-muted'),
          danger: token('--danger'),
          warning: token('--warning'),
          success: token('--success'),
          lime: token('--accent')
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      minHeight: {
        tap: token('--tap')
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        slideLeft: {
          from: { transform: 'translateX(24px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' }
        }
      },
      animation: {
        fadeIn: 'fadeIn 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        slideLeft: 'slideLeft 220ms cubic-bezier(0.16, 1, 0.3, 1)'
      },
      minWidth: {
        tap: token('--tap')
      }
    }
  },
  plugins: []
};
