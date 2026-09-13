// Design tokens for the Mess QR app
// Consistent colors, spacing, typography, and shadows used throughout

export const Colors = {
  // Primary brand
  primary: '#1a56db',
  primaryLight: '#e8f0fe',
  primaryDark: '#1240a8',

  // Success / meal scanned
  success: '#0e9f6e',
  successLight: '#f0fdf4',
  successDark: '#065f46',

  // Error / rejected
  error: '#e02424',
  errorLight: '#fef2f2',
  errorDark: '#9b1c1c',

  // Warning
  warning: '#d97706',
  warningLight: '#fffbeb',

  // Neutrals
  white: '#ffffff',
  black: '#111827',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',

  // Background
  background: '#f9fafb',
  surface: '#ffffff',

  // Meal type colors
  breakfast: '#f59e0b',
  lunch: '#3b82f6',
  dinner: '#8b5cf6',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const Typography = {
  h1: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.5 },
  h2: { fontSize: 24, fontWeight: '700' as const },
  h3: { fontSize: 20, fontWeight: '600' as const },
  h4: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyMd: { fontSize: 15, fontWeight: '500' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  captionMd: { fontSize: 13, fontWeight: '500' as const },
  tiny: { fontSize: 11, fontWeight: '400' as const },
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
};

export const MealColors: Record<string, string> = {
  breakfast: Colors.breakfast,
  lunch: Colors.lunch,
  dinner: Colors.dinner,
};

export const MealIcons: Record<string, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
};
