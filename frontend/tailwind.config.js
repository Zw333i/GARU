/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // CSS Variable-based colors for theme switching
        'deep-void': 'var(--deep-void)',
        'gunmetal': 'var(--gunmetal)',
        'electric-lime': 'var(--electric-lime)',
        'hot-pink': 'var(--hot-pink)',
        'ghost-white': 'var(--ghost-white)',
        'surface': 'var(--surface)',
        'muted': 'var(--muted)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 3s ease-in-out infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px #84CC16, 0 0 10px #84CC16, 0 0 15px #84CC16' },
          '100%': { boxShadow: '0 0 10px #84CC16, 0 0 20px #84CC16, 0 0 30px #84CC16' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}
