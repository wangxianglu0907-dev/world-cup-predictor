/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        apple: {
          bg: '#F5F5F7',
          card: '#FFFFFF',
          blue: '#0071E3',
          'blue-hover': '#0077ED',
          gray: '#86868B',
          'gray-light': '#AEAEB2',
          'gray-dark': '#1D1D1F',
          border: '#E5E7EB',
          'border-light': '#F0F0F0',
        },
        risk: {
          low: '#22C55E',
          mid: '#EAB308',
          high: '#EF4444',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"',
          '"SF Pro Display"', '"Helvetica Neue"', 'Helvetica', 'Arial',
          '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif',
        ],
      },
      boxShadow: {
        'apple': '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        'apple-lg': '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
      },
      borderRadius: {
        'apple': '18px',
      },
    },
  },
  plugins: [],
}
