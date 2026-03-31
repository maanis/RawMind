export const FONTS = {
  // Claude uses Source Serif 4 for body text feel
  serif: 'SourceSerif4_400Regular',
  serifMedium: 'SourceSerif4_600SemiBold',
  sans: 'SourceSans3_400Regular',
  sansMedium: 'SourceSans3_500Medium',
  sansSemiBold: 'SourceSans3_600SemiBold',
  mono: 'SpaceMono', // fallback monospace
};

export const LIGHT_THEME = {
  background: '#FFFFFF',
  surface: '#F9F9F8',
  surfaceAlt: '#F0F0EF',
  border: '#E5E5E4',
  borderStrong: '#CDCDC9',
  text: '#1A1A19',
  textSecondary: '#6B6B6A',
  textMuted: '#9B9B9A',
  userBubble: '#1A1A19',
  userBubbleText: '#FFFFFF',
  aiBubble: '#F0F0EF',
  aiBubbleText: '#1A1A19',
  accent: '#CF6C1B',
  accentLight: '#FDF3E9',
  codeBackground: '#F4F4F3',
  codeText: '#1A1A19',
  inputBackground: '#FFFFFF',
  inputBorder: '#E5E5E4',
  sidebarBackground: '#F9F9F8',
  headerBackground: '#FFFFFF',
  icon: '#6B6B6A',
  danger: '#DC2626',
  success: '#16A34A',
};

export const DARK_THEME = {
  background: '#1A1A19',
  surface: '#222221',
  surfaceAlt: '#2A2A29',
  border: '#333332',
  borderStrong: '#444443',
  text: '#ECECEB',
  textSecondary: '#9B9B9A',
  textMuted: '#6B6B6A',
  userBubble: '#ECECEB',
  userBubbleText: '#1A1A19',
  aiBubble: '#2A2A29',
  aiBubbleText: '#ECECEB',
  accent: '#E8854A',
  accentLight: '#2C1A0E',
  codeBackground: '#111110',
  codeText: '#ECECEB',
  inputBackground: '#222221',
  inputBorder: '#333332',
  sidebarBackground: '#111110',
  headerBackground: '#1A1A19',
  icon: '#9B9B9A',
  danger: '#F87171',
  success: '#4ADE80',
};

export type ThemeColors = typeof LIGHT_THEME;
