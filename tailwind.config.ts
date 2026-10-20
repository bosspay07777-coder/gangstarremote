import type { Config } from "tailwindcss";
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "sans-serif"], mono: ["JetBrains Mono", "monospace"] },
      borderRadius: { card: "20px", panel: "20px", btn: "12px", input: "12px" },
      colors: {
        bg: "hsl(var(--bg))", surface: "hsl(var(--surface))", border1: "hsl(var(--border1))",
        fg: "hsl(var(--fg))", muted: "hsl(var(--muted))", accent1: "#8b5cf6", accent2: "#3b82f6", accent3: "#ec4899"
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
};
export default config;
