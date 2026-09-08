import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B1220",
        paper: "#FAF7F2",
        brand: {
          50: "#FFF4EC",
          100: "#FFE4D0",
          400: "#F2894E",
          500: "#E4692A",
          600: "#C4531C",
          700: "#9B3F14"
        },
        stellar: {
          500: "#0A2540",
          600: "#081C33"
        },
        okgreen: "#1F8A4C"
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"]
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,18,32,0.06), 0 4px 16px rgba(11,18,32,0.06)"
      }
    }
  },
  plugins: []
};

export default config;
