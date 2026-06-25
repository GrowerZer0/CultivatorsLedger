import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canopy: "#264E36",
        clay: "#B8613B",
        mist: "#E8F0ED",
        graphite: "#1F2933"
      }
    }
  },
  plugins: []
};

export default config;
