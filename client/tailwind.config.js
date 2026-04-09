const path = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    path.join(__dirname, 'index.html'),
    path.join(__dirname, 'src/**/*.{ts,tsx}'),
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#03091a',
          900: '#060f24',
          800: '#0a1628',
          700: '#112035',
          600: '#1a3254',
          500: '#1e4080',
          400: '#2a5298',
          300: '#3d6abf',
        },
        field: {
          DEFAULT: '#15803d',
          dark: '#14532d',
          light: '#16a34a',
        },
        chalk: '#f1f5f9',
        scoreboard: '#0d1117',
      },
      boxShadow: {
        'glow-green': '0 0 12px rgba(22, 163, 74, 0.35)',
        'glow-blue': '0 0 12px rgba(59, 130, 246, 0.35)',
        'glow-gold': '0 0 12px rgba(234, 179, 8, 0.35)',
        'inset-navy': 'inset 0 1px 0 rgba(255,255,255,0.04)',
      },
    },
  },
  plugins: [],
};
