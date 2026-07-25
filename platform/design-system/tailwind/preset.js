/**
 * SWIFT Design System v1.0 — Tailwind CSS preset
 * Usage: presets: [require('../design-system/tailwind/preset.js')]
 * Or: import swiftPreset from '@swift/design-system/tailwind/preset.js'
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        swift: {
          white: "#FFFFFF",
          bg: "#FAFAFA",
          surface: "#F5F6F8",
          border: "#E7EAF0",
          text: "#1C1F26",
          muted: "#6B7280",
          blue: {
            DEFAULT: "#2563EB",
            soft: "#EFF4FF",
            hover: "#1D4ED8",
            pressed: "#1E40AF",
          },
          success: "#16A34A",
          warning: "#F59E0B",
          danger: "#DC2626",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      fontSize: {
        display: ["36px", { lineHeight: "1.15", fontWeight: "700", letterSpacing: "-0.02em" }],
        heading: ["24px", { lineHeight: "1.25", fontWeight: "600", letterSpacing: "-0.015em" }],
        title: ["28px", { lineHeight: "1.2", fontWeight: "600" }],
        body: ["16px", { lineHeight: "1.5", fontWeight: "400" }],
        button: ["15px", { lineHeight: "1.2", fontWeight: "500" }],
        caption: ["13px", { lineHeight: "1.4", fontWeight: "400" }],
      },
      spacing: {
        1: "4px",
        2: "8px",
        3: "16px",
        4: "24px",
        5: "32px",
        6: "40px",
        7: "48px",
        8: "64px",
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "16px",
      },
      boxShadow: {
        "elevation-1": "0 1px 2px rgba(28, 31, 38, 0.04)",
        "elevation-2": "0 4px 16px rgba(28, 31, 38, 0.06)",
        "elevation-3": "0 12px 40px rgba(28, 31, 38, 0.10)",
      },
      transitionDuration: {
        fast: "150ms",
        base: "200ms",
        slow: "250ms",
      },
    },
  },
};
