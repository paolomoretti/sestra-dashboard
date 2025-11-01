/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#1a1a1a',
          surface: '#2a2a2a',
          border: '#3a3a3a',
          text: '#ffffff',
          'text-muted': '#888888',
        }
      }
    },
  },
  plugins: [],
}
