/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './*.html',
    './js/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        accent: '#00ADB5',
        accentDark: '#00838F',
        highlight: '#FFD200',
        brand: '#FFC107',
        ink: '#2D2D2D',
        muted: '#555555',
        soft: '#6B6B6B',
        success: '#059669',
        warning: '#D97706',
        danger: '#DC2626',
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 5s ease-in-out infinite',
        'float': 'float 4s ease-in-out infinite',
        'fade-in': 'fadeIn 0.25s ease forwards',
        'scale-in': 'scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'shimmer': 'shimmer 1.5s infinite',
        'float-particle': 'floatParticle linear infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '0.08', transform: 'scale(1)' },
          '50%': { opacity: '0.12', transform: 'scale(1.05)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        floatParticle: {
          '0%': { transform: 'translateY(100vh) rotate(0deg)', opacity: '0' },
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
          '100%': { transform: 'translateY(-10vh) rotate(360deg)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
