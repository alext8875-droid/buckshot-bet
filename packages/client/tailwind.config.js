/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream:    '#ebdec7',
        rust:     '#ad5437',
        burnt:    '#5c2616',
        darkred:  '#5a0d0d',
        gold:     '#d69700',
        table:    '#0e0903',
        felt:     '#0a0f07',
      },
      fontFamily: {
        cinzel: ['Cinzel', 'Georgia', 'serif'],
        vt:     ['VT323', 'monospace'],
      },
      animation: {
        'pulse-red': 'pulseRed 1s ease-in-out infinite',
        shake:       'shake 0.4s ease-in-out',
      },
      keyframes: {
        pulseRed: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.5' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%':      { transform: 'translateX(-6px)' },
          '75%':      { transform: 'translateX(6px)' },
        },
      },
    },
  },
  plugins: [],
};
