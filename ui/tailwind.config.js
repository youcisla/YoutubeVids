/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        midnight: '#0A0D16',
        slate: {
          850: '#0F172A',
          950: '#0A0D16',
        },
        accent: {
          gold: '#FACC15',
          violet: '#A78BFA',
          emerald: '#34D399',
          orange: '#FB923C',
        },
      },
      fontFamily: {
        heading: ['Space Grotesk', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
