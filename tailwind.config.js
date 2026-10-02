/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "background": "#131315",
        "surface": "#131315",
        "surface-container-lowest": "#0e0e10",
        "surface-container-low": "#1c1b1d",
        "surface-container": "#201f22",
        "surface-container-high": "#27272a",
        "surface-container-highest": "#323236",
        "primary": "#9ee939",
        "primary-fixed": "#acf847",
        "primary-container": "#84cc16",
        "on-primary": "#132300",
        "on-surface": "#f4f4f5",
        "on-surface-variant": "#a1a1aa",
        "outline": "#52525b",
        "outline-variant": "#27272a",
        "secondary": "#4ae176",
        "tertiary": "#ffcb8d"
      },
      fontFamily: {
        "sans": ["Plus Jakarta Sans", "sans-serif"],
        "mono": ["JetBrains Mono", "monospace"]
      }
    },
  },
  plugins: [],
}
