/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bordeaux: '#c43960',
        schwarz: '#0a0510',
        hellrosa: '#f5ebef',
        mauve: '#b08090',
        bernstein: '#d09038',
        gruen: '#4a8f5e',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
