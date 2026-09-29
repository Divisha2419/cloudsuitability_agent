/** @type {import('tailwindcss').Config} */
// Colours follow the Deloitte theme in the reference deck (theme1.xml):
// greens 86BC25 / 43B02A / 26890D / 046A38, teal 0D8390, blue 007CB0, grey 53565A / D0D0CE.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Calibri", "Carlito", '"Segoe UI"', "Arial", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#f3f9e9", // light green tint (backgrounds, hover)
          100: "#e1f0c8",
          400: "#86bc25", // Deloitte green (accent, bars)
          600: "#26890d", // green (links, focus)
          700: "#046a38", // dark green (primary buttons, headers)
          900: "#023b1f",
        },
        dblue: { 50: "#e8f3f9", 600: "#007cb0", 700: "#005587" },
        teal: { 600: "#0d8390" },
        ink: { DEFAULT: "#000000", muted: "#53565a", line: "#d0d0ce" },
        // Status colours, used only for tech-stack compatibility and risk severity,
        // always paired with an icon (✓ ! ✕) and a label.
        good: "#26890d",
        warning: "#ed8b00",
        critical: "#da291c",
      },
    },
  },
  plugins: [],
};
