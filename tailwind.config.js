/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // RETAKE V2 战术指挥室 tokens (design-v2 §2)
        board: { 0: "#0A0D10", 1: "#10151B", 2: "#161D24", 3: "#1E2832" },
        "grid-line": "#182028",
        line: { DEFAULT: "#222C37", strong: "#33404E" },
        ink: { 1: "#E9EFEA", 2: "#98A5AF", 3: "#5B6873" },
        volt: {
          DEFAULT: "#C8FF3D",
          soft: "#D9FF7A",
          dim: "rgba(200,255,61,0.10)",
          glow: "rgba(200,255,61,0.35)",
        },
        // RETAKE V1 tokens（过渡兼容）
        "bg-0": "#080B10",
        "bg-1": "#0D1117",
        "bg-2": "#131A24",
        "bg-3": "#1A2332",
        border: "#1E2A3A",
        "border-strong": "#2E3D52",
        "text-1": "#EDF2F7",
        "text-2": "#94A3B8",
        "text-3": "#5B6B7F",
        brand: "#C8FF3D",
        "brand-dim": "rgba(200,255,61,0.12)",
        "t-side": "#FFB020",
        "t-dim": "rgba(255,176,32,0.15)",
        "ct-side": "#4DA3FF",
        "ct-dim": "rgba(77,163,255,0.15)",
        success: "#3DDC84",
        danger: "#FF5252",
        warning: "#FFC94D",
        // V2 语义别名（design-v2 §2）
        good: "#3DDC84",
        bad: "#FF5252",
        warn: "#FFC94D",
        "heat-cold": "#4DA3FF",
        "heat-mid": "#FFB020",
        "heat-hot": "#FF5252",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
      },
      fontFamily: {
        display: ['"Chakra Petch"', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        hand: ['Caveat', '"Long Cang"', 'cursive'],
      },
      keyframes: {
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "grid-drift": {
          from: { backgroundPosition: "0 0" },
          to: { backgroundPosition: "120px 120px" },
        },
        "float-y": {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
      },
      animation: {
        marquee: "marquee 30s linear infinite",
        "grid-drift": "grid-drift 40s linear infinite",
        "float-y": "float-y 3s ease-in-out infinite",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}