import type { Config } from "tailwindcss";

/**
 * The insights design system, verbatim in its tokens — this app is the same
 * surface over a different library, so it reads from the same variables.
 */
const config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    // The design system lives in another package; without this its classes are
    // purged and every primitive renders unstyled.
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  prefix: "",
  future: {
    // On touch, a `hover:` style sticks after the tap until you tap elsewhere.
    // This compiles every `hover:` to `@media (hover: hover)`.
    hoverOnlyWhenSupported: true,
  },
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        faint: { DEFAULT: "hsl(var(--faint-foreground))", foreground: "hsl(var(--faint-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
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
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      /* The elevation tokens, as `box-shadow` utilities. */
      boxShadow: {
        card: "var(--shadow-card)",
        tip: "var(--shadow-tip)",
        popover: "var(--shadow-popover)",
        panel: "var(--shadow-panel)",
        sheet: "var(--shadow-sheet)",
        float: "var(--shadow-float)",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.23, 1, 0.32, 1)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      typography: {
        DEFAULT: {
          css: {
            "code::before": { content: "none" },
            "code::after": { content: "none" },
            "blockquote p:first-of-type::before": { content: "none" },
            "blockquote p:last-of-type::after": { content: "none" },
            maxWidth: "none",

            /*
             * Headings carry the article's hierarchy by size, weight and space.
             * The plugin's defaults are sized for a marketing page — a 700-weight
             * 1.5em h2 over a serif body reads as shouting — and they do not
             * descend from the reader's own scale. These do, from the 30px title
             * down, and they are em, so they scale with the reader's text size.
             *
             * Space above is always larger than space below, so a heading groups
             * with the text it introduces rather than floating between two
             * paragraphs.
             */
            "h1, h2, h3, h4, h5, h6": {
              fontWeight: "600",
              color: "hsl(var(--foreground))",
              "text-wrap": "balance",
              // Lining figures in headings; the body drops to old-style below.
              // Old-style digits carry ascenders and descenders, so a number
              // sits in the text rather than interrupting it.
              fontVariantNumeric: "lining-nums",
            },
            p: {
              fontVariantNumeric: "oldstyle-nums",
            },
            h2: {
              fontSize: "1.35em",
              lineHeight: "1.25",
              letterSpacing: "-0.012em",
              marginTop: "2.2em",
              marginBottom: "0.6em",
            },
            h3: {
              fontSize: "1.15em",
              lineHeight: "1.3",
              letterSpacing: "-0.008em",
              marginTop: "1.9em",
              marginBottom: "0.5em",
            },
            h4: {
              fontSize: "1em",
              lineHeight: "1.4",
              marginTop: "1.7em",
              marginBottom: "0.4em",
            },
            "h5, h6": {
              fontSize: "0.9em",
              lineHeight: "1.4",
              marginTop: "1.5em",
              marginBottom: "0.35em",
              color: "hsl(var(--muted-foreground))",
            },
          },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;

export default config;
