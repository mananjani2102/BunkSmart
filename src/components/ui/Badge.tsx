import { View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import {
  fontFamily,
  radius,
  spacing,
  type ThemeColors,
} from '@/theme/tokens';

export type BadgeTone =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'info';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  dot?: boolean;
  style?: StyleProp<ViewStyle>;
}

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderRadius: radius.small,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeBordered: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.dot,
  },
  text: {
    fontFamily: fontFamily.medium,
  },
}));

function getBadgeVisual(tone: BadgeTone, colors: ThemeColors) {
  switch (tone) {
    case 'success':
      return {
        backgroundColor: colors.successBg,
        textColor: colors.success,
        dotColor: colors.success,
        bordered: false,
      };
    case 'warning':
      return {
        backgroundColor: colors.warningBg,
        textColor: colors.warningText,
        dotColor: colors.amber,
        bordered: false,
      };
    case 'destructive':
      return {
        backgroundColor: colors.destructiveBg,
        textColor: colors.destructiveText,
        dotColor: colors.destructive,
        bordered: false,
      };
    case 'info':
      return {
        backgroundColor: colors.card,
        textColor: colors.blue,
        dotColor: colors.blue,
        bordered: true,
      };
    case 'neutral':
    default:
      return {
        backgroundColor: colors.muted,
        textColor: colors.mutedForeground,
        dotColor: colors.mutedForeground,
        bordered: false,
      };
  }
}

export function Badge({
  label,
  tone = 'neutral',
  dot = false,
  style,
}: BadgeProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const visual = getBadgeVisual(tone, colors);

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: visual.backgroundColor },
        visual.bordered && styles.badgeBordered,
        style,
      ]}
    >
      {dot ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={[styles.dot, { backgroundColor: visual.dotColor }]}
        />
      ) : null}
      <AppText
        variant="caption"
        style={[styles.text, { color: visual.textColor }]}
        numberOfLines={1}
      >
        {label}
      </AppText>
    </View>
  );
}
