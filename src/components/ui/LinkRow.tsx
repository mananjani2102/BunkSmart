import { memo } from 'react';
import {
  Platform,
  Pressable,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import {
  fontFamily,
  radius,
  spacing,
  type ThemeColors,
} from '@/theme/tokens';

export interface LinkRowProps {
  prompt: string;
  actionLabel: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prompt: {
    paddingVertical: spacing.xs,
  },
  actionButton: {
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.control,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  actionPressed: {
    backgroundColor: colors.muted,
    opacity: 0.75,
  },
  actionDisabled: {
    opacity: 0.5,
  },
  actionText: {
    fontFamily: fontFamily.medium,
  },
}));

/**
 * Centered prompt with an adjacent link-colored action meeting the 44 dp minimum
 * touch target height.
 */
export const LinkRow = memo(function LinkRow({
  prompt,
  actionLabel,
  onPress,
  disabled = false,
  style,
}: LinkRowProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);

  const webCursor =
    Platform.OS === 'web' && !disabled ? ('pointer' as const) : undefined;

  return (
    <View style={[styles.row, style]}>
      <AppText variant="body" tone="muted" style={styles.prompt}>
        {prompt}
      </AppText>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        android_ripple={
          !disabled ? { color: colors.rippleNeutral, foreground: true } : undefined
        }
        accessibilityRole="link"
        accessibilityLabel={actionLabel}
        accessibilityState={{ disabled }}
        style={({ pressed }) => [
          styles.actionButton,
          webCursor && ({ cursor: webCursor } as ViewStyle),
          disabled && styles.actionDisabled,
          pressed && !disabled && styles.actionPressed,
        ]}
      >
        <AppText variant="body" tone="info" style={styles.actionText}>
          {actionLabel}
        </AppText>
      </Pressable>
    </View>
  );
});
