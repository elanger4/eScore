import type { Config } from 'tailwindcss';
import path from 'path';

const config: Config = {
  content: [
    path.join(__dirname, 'index.html'),
    path.join(__dirname, 'src/**/*.{ts,tsx}'),
  ],
  theme: {
    extend: {
      colors: {
        field: {
          green: '#2d5a1b',
          dirt: '#c4935a',
        },
      },
    },
  },
  plugins: [],
};

export default config;
