import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./store/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./types/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--bg-void)",
        base: "var(--bg-base)",
        surface: "var(--bg-surface)",
        elevated: "var(--bg-elevated)",
        highlight: "var(--bg-highlight)",
        border: "rgba(99,102,241,0.12)",
        primary: "#6366F1",
        foreground: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        muted: "var(--text-muted)",
        code: "var(--text-code)",
        private: "var(--color-private)",
        public: "var(--color-public)",
        warning: "var(--color-warning)",
        info: "var(--color-info)",
        btc: "var(--color-btc)",
        proof: "var(--color-proof)",
        "node-condition": "var(--node-condition)",
        "node-split": "var(--node-split)",
        "node-execute": "var(--node-execute)",
        "node-constraint": "var(--node-constraint)",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        code: ["var(--font-code)", "monospace"],
        body: ["var(--font-body)", "sans-serif"],
      },
      boxShadow: {
        card: "0 0 0 1px rgba(99,102,241,0.12)",
        condition: "0 0 20px #06B6D430",
        split: "0 0 20px #F59E0B30",
        execute: "0 0 20px #10B98130",
        constraint: "0 0 20px #8B5CF630",
      },
    },
  },
  plugins: [typography],
};

export default config;
