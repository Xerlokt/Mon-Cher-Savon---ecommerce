import { colors } from '@mon-cher-savon/ui-tokens';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sage: { 400: colors.sage400, 700: colors.sage700 },
        cream: { 50: colors.cream50 },
        clay: { 100: colors.clay100 },
        terracotta: { 600: colors.terracotta600 },
        ink: { 900: colors.ink900 },
        success: colors.success,
        warning: colors.warning,
        danger: colors.danger,
      },
      fontFamily: {
        heading: ['var(--font-fraunces)', 'Georgia', 'serif'],
        body: ['var(--font-nunito)', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '16px' },
      boxShadow: { soft: '0 4px 20px rgba(43, 42, 38, 0.08)' },
    },
  },
  plugins: [],
};
