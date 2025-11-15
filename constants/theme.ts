// Pleasant color theme for Kala.ai
export const colors = {
  // Primary colors - warm, earthy tones
  primary: '#FF6B35', // Warm coral/orange
  primaryLight: '#FF8C61',
  primaryDark: '#E55A2B',
  
  // Secondary colors
  secondary: '#4ECDC4', // Soft teal
  secondaryLight: '#6EDDD6',
  secondaryDark: '#3AB5AE',
  
  // Accent colors
  accent: '#FFD93D', // Warm yellow
  accentLight: '#FFE66D',
  
  // Neutral colors
  background: '#F8F6F4', // Warm off-white
  surface: '#FFFFFF',
  surfaceElevated: '#FFFBF8',
  
  // Text colors
  textPrimary: '#2C3E50', // Dark blue-gray
  textSecondary: '#6C757D', // Medium gray
  textLight: '#95A5A6', // Light gray
  
  // Status colors
  success: '#27AE60', // Green
  warning: '#F39C12', // Orange
  error: '#E74C3C', // Red
  info: '#3498DB', // Blue
  
  // Border and divider
  border: '#E8E6E3',
  divider: '#D5D3D0',
  
  // Shadows
  shadow: 'rgba(0, 0, 0, 0.1)',
  shadowLight: 'rgba(0, 0, 0, 0.05)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  round: 999,
};

export const typography = {
  h1: { fontSize: 32, fontWeight: '700' as const, lineHeight: 40 },
  h2: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32 },
  h3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodySmall: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
};
