/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        wa: {
          header: '#075E54',
          teal: '#128C7E',
          green: '#25D366',
          outgoing: '#DCF8C6',
          bg: '#ECE5DD',
          incoming: '#FFFFFF',
          ink: '#111B21',
          muted: '#667781',
        },
      },
      fontFamily: {
        sans: ['"Inter"', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        nastaliq: ['"Noto Nastaliq Urdu"', 'serif'],
      },
      boxShadow: {
        bubble: '0 1px 0.5px rgba(0,0,0,0.13)',
      },
    },
  },
  plugins: [],
}
