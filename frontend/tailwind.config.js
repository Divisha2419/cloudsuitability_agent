/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#eef4fb", 100: "#d6e4f5", 600: "#2b5d97", 700: "#1f4a7c", 900: "#1f3a5f" },
        // Status colours (good / warning / serious / critical), always paired with an icon and label.
        good: "#0ca30c",
        warning: "#fab219",
        serious: "#ec835a",
        critical: "#d03b3b",
      },
    },
  },
  plugins: [],
};
