import { Ionicons } from '@expo/vector-icons';
import { type ComponentProps } from 'react';
import {
  Platform,
  Pressable,
  View,
  type AccessibilityRole,
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

export type ListRowIconName = ComponentProps<typeof Ionicons>['name'];

export interface ListRowProps {
  title: string;
  subtitle?: string;
  rightText?: string;
  chevron?: boolean;
  onPress?: () => void;
  icon?: ListRowIconName;
  destructive?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  style?: StyleProp<ViewStyle>;
}

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowPressed: {
    backgroundColor: colors.muted,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: radius.control,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxDestructive: {
    backgroundColor: colors.destructiveBg,
  },
  textCol: {
    flex: 1,
    minWidth: 96,
    gap: 2,
  },
  title: {
    fontFamily: fontFamily.medium,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: spacing.xs,
  },
  rightText: {
    flexShrink: 1,
  },
}));

export function ListRow({
  title,
  subtitle,
  rightText,
  chevron = false,
  onPress,
  icon,
  destructive = false,
  disabled = false,
  accessibilityLabel,
  accessibilityRole = 'button',
  style,
}: ListRowProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);

  const iconColor = destructive ? colors.destructiveText : colors.foreground;

  const content = (
    <>
      {icon ? (
        <View
          style={[styles.iconBox, destructive && styles.iconBoxDestructive]}
        >
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
      ) : null}

      <View style={styles.textCol}>
        <AppText
          variant="body"
          tone={destructive ? 'danger' : 'default'}
          style={styles.title}
          numberOfLines={2}
        >
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="muted" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>

      {rightText || chevron ? (
        <View style={styles.rightGroup}>
          {rightText ? (
            <AppText
              variant="caption"
              tone="muted"
              numberOfLines={1}
              style={styles.rightText}
            >
              {rightText}
            </AppText>
          ) : null}
          {chevron ? (
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.mutedForeground}
            />
          ) : null}
        </View>
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View
        style={[styles.row, disabled && styles.rowDisabled, style]}
        accessibilityLabel={accessibilityLabel}
      >
        {content}
      </View>
    );
  }

  const webCursor =
    Platform.OS === 'web' && !disabled ? ('pointer' as const) : undefined;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={
        !disabled ? { color: colors.rippleNeutral, foreground: true } : undefined
      }
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.row,
        webCursor && ({ cursor: webCursor } as ViewStyle),
        disabled && styles.rowDisabled,
        pressed && !disabled && styles.rowPressed,
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}
