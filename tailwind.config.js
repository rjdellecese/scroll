/** @type {import('tailwindcss').Config} */

const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  content: ["./src/**/*.{html,ts,tsx}"],
  theme: {
    fontFamily: {
      sans: ["MulishVariable", ...defaultTheme.fontFamily.sans],
      serif: ["LoraVariable", ...defaultTheme.fontFamily.serif],
      mono: ["JetBrains MonoVariable", ...defaultTheme.fontFamily.mono],
    },
    extend: {},
  },
  plugins: [],
};
