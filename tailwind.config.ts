import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./client/src/**/*.{js,ts,jsx,tsx,mdx}",
    "./client/index.html",
  ],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar-background)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "pill-pulse": {
          "0%, 100%": {
            boxShadow: "0 0 4px 1px rgba(234, 179, 8, 0.2)",
            borderColor: "rgba(250, 204, 21, 0.4)",
          },
          "50%": {
            boxShadow: "0 0 12px 4px rgba(234, 179, 8, 0.5), 0 0 20px 6px rgba(234, 179, 8, 0.25)",
            borderColor: "rgba(250, 204, 21, 0.9)",
          },
        },
        "pulse-glow-green": {
          "0%, 100%": {
            boxShadow: "0 0 8px 2px rgba(52, 211, 153, 0.4), 0 0 16px 4px rgba(16, 185, 129, 0.2)",
            borderColor: "rgba(52, 211, 153, 0.7)",
          },
          "50%": {
            boxShadow: "0 0 12px 4px rgba(52, 211, 153, 0.6), 0 0 24px 8px rgba(16, 185, 129, 0.3)",
            borderColor: "rgba(110, 231, 183, 0.9)",
          },
        },
        "pulse-glow-amber": {
          "0%, 100%": {
            boxShadow: "0 0 8px 2px rgba(245, 158, 11, 0.4), 0 0 16px 4px rgba(217, 119, 6, 0.2)",
            borderColor: "rgba(245, 158, 11, 0.7)",
          },
          "50%": {
            boxShadow: "0 0 12px 4px rgba(245, 158, 11, 0.6), 0 0 24px 8px rgba(217, 119, 6, 0.3)",
            borderColor: "rgba(251, 191, 36, 0.9)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pill-pulse": "pill-pulse 2s ease-in-out infinite",
        "pulse-glow-green": "pulse-glow-green 2s ease-in-out infinite",
        "pulse-glow-amber": "pulse-glow-amber 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;