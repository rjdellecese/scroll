/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  content: ["./src/**/*.{html,ts,tsx}"],
  theme: {
    fontFamily: {
      sans: ["Mulish Variable", ...defaultTheme.fontFamily.sans],
      serif: ["Lora Variable", ...defaultTheme.fontFamily.serif],
      mono: ["JetBrains Mono Variable", ...defaultTheme.fontFamily.mono],
    },
    extend: {},
  },
  plugins: [],
};
