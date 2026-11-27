import { type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useReduceMotion } from '@/lib/motion';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { radius, shadows, spacing, type ThemeColors } from '@/theme/tokens';

export interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.lg,
    ...shadows.none,
  },
  pressableCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.lg,
    overflow: 'hidden',
    ...shadows.none,
  },
  pressed: {
    backgroundColor: colors.muted,
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },
  pressedReducedMotion: {
    backgroundColor: colors.muted,
  },
}));

export function Card({
  children,
  onPress,
  style,
  accessibilityLabel,
  testID,
}: CardProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const reduceMotion = useReduceMotion();

  if (!onPress) {
    return (
      <View style={[styles.card, style]} testID={testID}>
        {children}
      </View>
    );
  }

  const webCursor =
    Platform.OS === 'web' ? ('pointer' as const) : undefined;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: colors.rippleNeutral, foreground: true }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={({ pressed }) => [
        styles.pressableCard,
        webCursor && ({ cursor: webCursor } as ViewStyle),
        pressed &&
          (reduceMotion ? styles.pressedReducedMotion : styles.pressed),
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}
