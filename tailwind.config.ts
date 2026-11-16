import type { Config } from "tailwindcss";
import { UI_COLORS } from "./src/lib/designTokens";

const color = (key: keyof typeof UI_COLORS) => `rgb(var(--cp-${key}) / <alpha-value>)`;
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: color("canvas"),
          panel: color("surface"),
          raised: color("raised"),
          line: color("line"),
        },
        signal: {
          DEFAULT: color("primary"),
          dim: color("primaryHover"),
        },
        amber: {
          DEFAULT: color("pending"),
        },
        critical: {
          DEFAULT: color("danger"),
        },
        cyan: {
          DEFAULT: color("secondary"),
        },
        ivory: color("text"),
        success: color("success"),
        progress: color("progress"),
        accent: color("accent"),
        slate: {
          soft: color("muted"),
        },
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      keyframes: {
        sweep: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        ping1: {
          "0%": { transform: "scale(0.6)", opacity: "0.8" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
        rise: {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(229,85,92,0.45)" },
          "50%": { boxShadow: "0 0 0 6px rgba(229,85,92,0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
        toastIn: {
          "0%": { transform: "translateX(16px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        scaleIn: {
          "0%": { transform: "scale(0.96)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        sweep: "sweep 4s linear infinite",
        ping1: "ping1 2.4s cubic-bezier(0,0,0.2,1) infinite",
        rise: "rise 0.5s ease-out both",
        glowPulse: "glowPulse 2s ease-in-out infinite",
        shimmer: "shimmer 1.6s ease-in-out infinite",
        toastIn: "toastIn 0.3s ease-out both",
        scaleIn: "scaleIn 0.2s ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;
