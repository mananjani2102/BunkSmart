import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, typography } from '@/theme/tokens';

export type AppTextVariant = keyof typeof typography;
export type AppTextTone =
  | 'default'
  | 'muted'
  | 'safe'
  | 'warn'
  | 'danger'
  | 'onAccent';

export interface AppTextProps extends TextProps {
  variant?: AppTextVariant;
  tone?: AppTextTone;
}

const toneColorMap: Record<AppTextTone, string> = {
  default: colors.text,
  muted: colors.textMuted,
  safe: colors.safe,
  warn: colors.warn,
  danger: colors.danger,
  onAccent: colors.onAccent,
};

export function AppText({
  variant = 'body',
  tone = 'default',
  maxFontSizeMultiplier = 1.4,
  style,
  ...rest
}: AppTextProps) {
  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        styles.base,
        typography[variant],
        { color: toneColorMap[tone] },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
  },
});
