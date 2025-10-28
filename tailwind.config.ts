import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        mu: {
          primary: "#DA291C",
        },
        leeds: {
          primary: "#FFCD00",
          secondary: "#1D428A",
        },
        ufc: {
          primary: "#1A1A1A",
        },
      },
    },
  },
  plugins: [],
};

export default config;
