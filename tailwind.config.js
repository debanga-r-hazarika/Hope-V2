/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0F172A', // Slate 900 - Deep, professional
          light: '#334155',   // Slate 700
          dark: '#020617',    // Slate 950
          foreground: '#F8FAFC', // Slate 50
        },
        accent: {
          DEFAULT: '#0EA5E9', // Sky 500 - Vibrant but professional
          light: '#38BDF8',   // Sky 400
          dark: '#0284C7',    // Sky 600
          foreground: '#FFFFFF',
        },
        sidebar: {
          DEFAULT: '#0F172A', // Match primary for consistency
          dark: '#020617',
          hover: '#1E293B',   // Slate 800
        },
        background: '#F8FAFC', // Slate 50 - Light, airy background
        surface: '#FFFFFF',    // White cards
        border: '#E2E8F0',     // Slate 200 - Subtle borders
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'system-ui', '-apple-system', 'sans-serif'], // Can add a display font later
      },
      boxShadow: {
        'premium-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'premium': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'premium-md': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'premium-lg': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      }
    },
  },
  plugins: [],
};
