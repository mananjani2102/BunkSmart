import { Ionicons } from '@expo/vector-icons';
import { type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useReduceMotion } from '@/lib/motion';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, type ThemeColors } from '@/theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';
export type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface ButtonProps {
  title: string;
  loadingLabel?: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: IoniconName;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

interface VariantVisual {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  foregroundColor: string;
  rippleColor: string;
}

function getVariantVisual(
  variant: ButtonVariant,
  colors: ThemeColors
): VariantVisual {
  switch (variant) {
    case 'secondary':
      return {
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        foregroundColor: colors.foreground,
        rippleColor: colors.rippleNeutral,
      };
    case 'destructive':
      return {
        backgroundColor: colors.destructive,
        borderColor: colors.destructive,
        borderWidth: 1,
        foregroundColor: colors.destructiveForeground,
        rippleColor: colors.ripplePrimary,
      };
    case 'ghost':
      return {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        borderWidth: 0,
        foregroundColor: colors.foreground,
        rippleColor: colors.rippleNeutral,
      };
    case 'primary':
    default:
      return {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
        borderWidth: 1,
        foregroundColor: colors.primaryForeground,
        rippleColor: colors.ripplePrimary,
      };
  }
}

const getStyles = createThemedStyles(() => ({
  base: {
    minHeight: 44,
    borderRadius: radius.control,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: spacing.sm,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  pressedReducedMotion: {
    opacity: 0.85,
  },
}));

export function Button({
  title,
  loadingLabel,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  accessibilityLabel,
  style,
  testID,
}: ButtonProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const reduceMotion = useReduceMotion();
  const isDisabled = disabled || loading;
  const visual = getVariantVisual(variant, colors);

  const handlePress = () => {
    if (isDisabled) {
      return;
    }
    onPress();
  };

  const webCursor =
    Platform.OS === 'web' && !isDisabled ? ('pointer' as const) : undefined;

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      android_ripple={
        !isDisabled ? { color: visual.rippleColor, foreground: true } : undefined
      }
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ?? (loading && loadingLabel ? loadingLabel : title)
      }
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.fullWidth,
        {
          backgroundColor: visual.backgroundColor,
          borderColor: visual.borderColor,
          borderWidth: visual.borderWidth,
        },
        webCursor && ({ cursor: webCursor } as ViewStyle),
        isDisabled && styles.disabled,
        pressed &&
          !isDisabled &&
          (reduceMotion ? styles.pressedReducedMotion : styles.pressed),
        style,
      ]}
    >
      {loading ? (
        loadingLabel ? (
          <View style={styles.content}>
            <ActivityIndicator
              size="small"
              color={visual.foregroundColor}
              style={styles.icon}
            />
            <AppText
              variant="label"
              style={{ color: visual.foregroundColor }}
              numberOfLines={1}
            >
              {loadingLabel}
            </AppText>
          </View>
        ) : (
          <ActivityIndicator size="small" color={visual.foregroundColor} />
        )
      ) : (
        <View style={styles.content}>
          {icon ? (
            <Ionicons
              name={icon}
              size={18}
              color={visual.foregroundColor}
              style={styles.icon}
            />
          ) : null}
          <AppText
            variant="label"
            style={{ color: visual.foregroundColor }}
            numberOfLines={1}
          >
            {title}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}
