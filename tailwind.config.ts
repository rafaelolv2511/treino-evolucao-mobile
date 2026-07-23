import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0A0A09", // Preto Rack
        surface: "#101010",
        deep: "#0D0D0D",
        line: "#1F1F1F",
        iron: "#262626",
        giz: "#FAFAFA",
        muted: "#8A8A88",
        faded: "#6E6E6E",
        aqua: "#44E2D9",
        fire: "#FF5C1F",
        // aliases da paleta anterior — apontam para o Aqua, sem quebrar classes existentes
        glow: "#44E2D9",
        viol: "#44E2D9",
        ok: "#44E2D9",
        warn: "#FF5C1F",
      },
      fontFamily: {
        brand: ["Archivo", "system-ui", "sans-serif"],
        stat: ["Anton", "Space Grotesk", "sans-serif"],
        display: ["Space Grotesk", "system-ui", "sans-serif"],
        body: ["Space Grotesk", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
