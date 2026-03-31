import { useColorScheme } from 'react-native';
import { useAppStore } from '@/store';
import { LIGHT_THEME, DARK_THEME, ThemeColors } from '@/constants/theme';

export const useTheme = (): { colors: ThemeColors; isDark: boolean } => {
  const systemScheme = useColorScheme();
  const theme = useAppStore((s) => s.theme);

  const isDark =
    theme === 'dark' || (theme === 'system' && systemScheme === 'dark');

  return {
    colors: isDark ? DARK_THEME : LIGHT_THEME,
    isDark,
  };
};
