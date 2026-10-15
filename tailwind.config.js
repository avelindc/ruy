/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // BREAKOUT MUSIC Dark Theme
        'bg-primary': '#0a0a0a',
        'bg-secondary': '#1a1a1a',
        'bg-tertiary': '#2a2a2a',
        'text-primary': '#ffffff',
        'text-secondary': '#9ca3af',
        'accent-purple': '#8b5cf6',
        'accent-blue': '#3b82f6',
        'border-dark': '#333333',
        // Legacy colors (kept for compatibility)
        primary: '#8b5cf6',
        secondary: '#3b82f6',
        accent: '#a78bfa',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-dark': 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)',
      },
    },
  },
  plugins: [],
}
