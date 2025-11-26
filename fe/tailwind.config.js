/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#7c3aed', // violet-600
          hover: '#6d28d9',   // violet-700
          light: '#8b5cf6',   // violet-500
        },
        sidebar: {
          bg: '#0f172a',      // slate-900
          text: '#e2e8f0',    // slate-200
          active: '#1e293b',  // slate-800
        },
      },
    },
  },
  plugins: [],
}
