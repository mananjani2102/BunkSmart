import { Text, type TextProps } from 'react-native';

import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { typography, type ThemeColors } from '@/theme/tokens';

export type AppTextVariant = keyof typeof typography;
export type AppTextTone =
  | 'default'
  | 'muted'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

export interface AppTextProps extends TextProps {
  variant?: AppTextVariant;
  tone?: AppTextTone;
}

const getStyles = createThemedStyles(() => ({
  base: {
    includeFontPadding: false,
  },
}));

function resolveToneColor(tone: AppTextTone, colors: ThemeColors): string {
  switch (tone) {
    case 'muted':
      return colors.mutedForeground;
    case 'success':
      return colors.success;
    case 'warning':
      return colors.warningText;
    case 'danger':
      return colors.destructiveText;
    case 'info':
      return colors.blue;
    case 'default':
    default:
      return colors.foreground;
  }
}

export function AppText({
  variant = 'body',
  tone,
  maxFontSizeMultiplier = 1.4,
  style,
  ...rest
}: AppTextProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const resolvedTone: AppTextTone =
    tone ?? (variant === 'caption' ? 'muted' : 'default');

  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        styles.base,
        typography[variant],
        { color: resolveToneColor(resolvedTone, colors) },
        style,
      ]}
      {...rest}
    />
  );
}
