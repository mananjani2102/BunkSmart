import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, type ThemeColors } from '@/theme/tokens';

export interface FormErrorProps {
  message?: string | null;
  style?: StyleProp<ViewStyle>;
}

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.destructiveBg,
    borderRadius: radius.control,
    padding: spacing.md,
  },
  icon: {
    marginTop: 1,
  },
  text: {
    flex: 1,
  },
}));

/**
 * Accessible inline banner for form-level errors announced as an alert.
 */
export const FormError = memo(function FormError({
  message,
  style,
}: FormErrorProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);

  if (!message) {
    return null;
  }

  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.banner, style]}
    >
      <Ionicons
        name="alert-circle-outline"
        size={18}
        color={colors.destructiveText}
        style={styles.icon}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <AppText variant="label" tone="danger" style={styles.text}>
        {message}
      </AppText>
    </View>
  );
});
