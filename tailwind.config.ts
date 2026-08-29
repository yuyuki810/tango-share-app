import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "#F5F4EF",
          card: "#FFFFFF",
          hover: "#EFECE3",
        },
        ink: {
          DEFAULT: "#232A3B",
          muted: "#626B7F",
          subtle: "#8D95A5",
        },
        akashiito: {
          DEFAULT: "#E2483D",
          hover: "#C9382E",
          subtle: "#FDF2F1",
          border: "#F7B8B3",
        },
        highlighter: {
          DEFAULT: "#F5C84C",
          subtle: "#FEF8E8",
        },
        line: {
          DEFAULT: "#D8D3C4",
          light: "#EBE8DF",
        },
      },
      fontFamily: {
        mincho: ["var(--font-shippori)", "serif"],
        gothic: ["var(--font-zen-kaku)", "sans-serif"],
        number: ["var(--font-zen-maru)", "sans-serif"],
      },
      boxShadow: {
        paper: "0 2px 8px -2px rgba(35, 42, 59, 0.05), 0 1px 3px -1px rgba(35, 42, 59, 0.05)",
        sheet: "0 8px 24px -6px rgba(226, 72, 61, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
