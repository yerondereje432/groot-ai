/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Glassy Verdigris Lab
        deep: "#071315",
        deep2: "#0B1C1E",
        surface: { glass: "rgba(14,42,44,0.55)", solid: "#0C1F21", card: "rgba(16,46,48,0.62)" },
        verdigris: { DEFAULT: "#2DD4BF", bright: "#5FFFE6", deep: "#0B6B5C", dim: "#1AAE9B" },
        ink: { DEFAULT: "#E8FFF8", soft: "#9BCBC0", faint: "#5F8B82", muted: "#3D6A60" },
        glassline: "rgba(158,255,229,0.14)",
        glassline2: "rgba(158,255,229,0.24)",
        amber: "#FFC86B",
        coral: "#FF7A6B",
        subject: {
          science: "#22C5A6",
          math: "#FF8A5B",
          language: "#6BA8FF",
          social: "#E8B86B",
        },
        success: "#2DD4BF",
        danger: "#FF6B6B",
      },
      fontFamily: {
        display: ["'Fraunces'", "Georgia", "serif"],
        sans: ["'Plus Jakarta Sans'", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glass: "inset 0 1px 0 rgba(255,255,255,0.07), 0 8px 40px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.35)",
        "glass-soft": "inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 24px rgba(0,0,0,0.38)",
        glow: "0 0 40px rgba(45,212,191,0.18), 0 0 80px rgba(45,212,191,0.06)",
        "glow-strong": "0 0 60px rgba(95,255,230,0.22)",
        float: "0 24px 60px rgba(0,0,0,0.55)",
      },
      backdropBlur: { xs: "2px", "24px": "24px" },
      borderRadius: { glass: "22px", "glass-lg": "28px" },
      animation: {
        "float-slow": "float 22s ease-in-out infinite",
        "float-med": "float 16s ease-in-out infinite reverse",
        "orb-drift": "orbDrift 28s ease-in-out infinite",
        "fade-up": "fadeUp .34s cubic-bezier(.22,1,.36,1) both",
        "glow-pulse": "glowPulse 3.5s ease-in-out infinite",
        "shimmer": "shimmer 1.8s linear infinite",
      },
      keyframes: {
        float: { "0%,100%":{transform:"translateY(0) translateX(0)"}, "50%":{transform:"translateY(-22px) translateX(8px)"} },
        orbDrift: { "0%,100%":{transform:"translate(0,0) scale(1)"}, "33%":{transform:"translate(18px,-28px) scale(1.05)"}, "66%":{transform:"translate(-14px,16px) scale(0.97)" } },
        fadeUp: { from:{opacity:0, transform:"translateY(12px)"}, to:{opacity:1, transform:"translateY(0)"} },
        glowPulse: { "0%,100%":{opacity:.55}, "50%":{opacity:1} },
        shimmer: { "0%":{backgroundPosition:"200% 0"}, "100%":{backgroundPosition:"-200% 0"} },
      },
      maxWidth: { chat: "800px" },
    },
  },
  plugins: [],
};