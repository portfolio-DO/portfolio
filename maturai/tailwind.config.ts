import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        display: ["Syne", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        bg: {
          DEFAULT: "#060812",
          2: "#0c1020",
          3: "#111827",
        },
        surface: {
          DEFAULT: "#131929",
          2: "#1a2235",
        },
        border: {
          DEFAULT: "#1e2d4a",
          2: "#2a3d5c",
        },
        brand: {
          blue: "#3b82f6",
          purple: "#8b5cf6",
          cyan: "#06b6d4",
        },
      },
      backgroundImage: {
        "gradient-brand": "linear-gradient(135deg, #3b82f6, #8b5cf6)",
        "gradient-cyan": "linear-gradient(135deg, #06b6d4, #3b82f6)",
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "20px",
      },
      boxShadow: {
        glow: "0 0 40px rgba(59, 130, 246, 0.15)",
        "glow-lg": "0 0 60px rgba(139, 92, 246, 0.2)",
        "glow-blue": "0 0 30px rgba(59, 130, 246, 0.4)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease",
        "slide-up": "slideUp 0.4s ease",
        shimmer: "shimmer 1.5s infinite",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200%" },
          "100%": { backgroundPosition: "-200%" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
