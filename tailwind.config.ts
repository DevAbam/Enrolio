import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Semantic tokens ────────────────────────────────────────────────────
        // These reference CSS custom properties defined in globals.css.
        // To retheme the ENTIRE app, only edit the variables in globals.css.
        bg:      'var(--bg)',
        surface: {
          DEFAULT: 'var(--surface)',
          alt:     'var(--surface-alt)',
        },
        border:  'var(--border)',
        fg: {
          DEFAULT: 'var(--fg)',
          muted:   'var(--fg-muted)',
          subtle:  'var(--fg-subtle)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          dark:    'var(--accent-dark)',
          bg:      'var(--accent-bg)',
          fg:      'var(--accent-fg)',
        },

        // ── Brand palette ──────────────────────────────────────────────────────
        // Used for chart colours and semantic indicators only — not structural UI.
        // Update these alongside --accent* variables in globals.css when retheming.
        brand: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
