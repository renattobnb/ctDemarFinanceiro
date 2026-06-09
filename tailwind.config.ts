import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        fundo: "#f7f7f4",
        tinta: "#1e2428",
        destaque: "#0f766e",
        alerta: "#b45309",
        perigo: "#b91c1c"
      },
      boxShadow: {
        suave: "0 18px 50px rgba(30, 36, 40, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
