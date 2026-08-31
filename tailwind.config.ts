import type { Config } from "tailwindcss";

/**
 * Design tokens del sistema visual de QuienLoHace.
 * Proporción de uso buscada: ~75% neutros / 20% azul / 5% amarillo.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          950: "#101F3C",
          900: "#182D53",
          800: "#20375F",
          700: "#30466F",
          600: "#455D88",
          100: "#EEF1F7",
        },
        accent: {
          DEFAULT: "#F4C542",
          hover: "#E9B92F",
          soft: "#FEF8E7",
          ink: "#7A5A05",
        },
        ink: {
          DEFAULT: "#172033",
          muted: "#475467",
          soft: "#667085",
          faint: "#98A2B3",
        },
        line: {
          DEFAULT: "#E4E7EC",
          soft: "#EFF1F5",
          strong: "#D8DDE6",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#F7F8FA",
          sunken: "#F5F6F8",
        },
        footer: {
          DEFAULT: "#1D1815",
          text: "#B8B1AC",
          line: "#322A26",
        },
        whatsapp: "#25A366",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(180deg,#455D88 0%,#182D53 100%)",
        /* La portada de las cards usa una rampa propia, más clara que la de marca. */
        "card-gradient": "linear-gradient(180deg,#455D88 0%,#20375F 100%)",
        "header-gradient":
          "linear-gradient(90deg,#101F3C 0%,#1B3055 42%,#3A5081 100%)",
        hatch:
          "repeating-linear-gradient(135deg,rgba(255,255,255,.07) 0 1px,transparent 1px 9px)",
      },
      borderRadius: {
        input: "10px",
        card: "14px",
      },
      maxWidth: {
        shell: "1240px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(23,32,51,.04)",
        "card-hover": "0 10px 24px -8px rgba(23,32,51,.16)",
        pop: "0 24px 48px -20px rgba(10,20,40,.4)",
        mega: "0 18px 40px -20px rgba(23,32,51,.25)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
