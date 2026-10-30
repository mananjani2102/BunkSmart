import { Ionicons } from '@expo/vector-icons';
import { type ComponentProps } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, radius, spacing } from '@/theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface ButtonProps {
  title: string;
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

interface VariantStyle {
  backgroundColor: string;
  pressedBackgroundColor: string;
  borderColor: string;
  borderWidth: number;
  foregroundColor: string;
  rippleColor: string;
}

const variantStyles: Record<ButtonVariant, VariantStyle> = {
  primary: {
    backgroundColor: colors.accent,
    pressedBackgroundColor: colors.accentPressed,
    borderColor: colors.accent,
    borderWidth: 1,
    foregroundColor: colors.onAccent,
    rippleColor: colors.rippleOnAccent,
  },
  secondary: {
    backgroundColor: colors.surface,
    pressedBackgroundColor: colors.surfacePressed,
    borderColor: colors.border,
    borderWidth: 1,
    foregroundColor: colors.text,
    rippleColor: colors.rippleNeutral,
  },
  danger: {
    backgroundColor: colors.danger,
    pressedBackgroundColor: colors.dangerPressed,
    borderColor: colors.danger,
    borderWidth: 1,
    foregroundColor: colors.onAccent,
    rippleColor: colors.rippleOnAccent,
  },
  ghost: {
    backgroundColor: 'transparent',
    pressedBackgroundColor: colors.accentSoft,
    borderColor: 'transparent',
    borderWidth: 0,
    foregroundColor: colors.accent,
    rippleColor: colors.rippleAccent,
  },
};

export function Button({
  title,
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
  const isDisabled = disabled || loading;
  const config = variantStyles[variant];

  const handlePress = () => {
    if (isDisabled) {
      return;
    }
    onPress();
  };

  return (
    <PressableScale
      onPress={handlePress}
      disabled={isDisabled}
      scaleTo={0.975}
      rippleColor={config.rippleColor}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      testID={testID}
      containerStyle={[
        styles.wrapper,
        fullWidth && styles.fullWidth,
        {
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
          borderWidth: config.borderWidth,
        },
        isDisabled && styles.disabled,
        style,
      ]}
      style={({ pressed }) => [
        styles.pressable,
        pressed &&
          !isDisabled && { backgroundColor: config.pressedBackgroundColor },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={config.foregroundColor} />
      ) : (
        <View style={styles.content}>
          {icon ? (
            <Ionicons
              name={icon}
              size={18}
              color={config.foregroundColor}
              style={styles.icon}
            />
          ) : null}
          <AppText
            variant="label"
            style={[styles.label, { color: config.foregroundColor }]}
            numberOfLines={1}
          >
            {title}
          </AppText>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: 48,
    borderRadius: radius.control,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  pressable: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: spacing.sm,
  },
  label: {
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.55,
  },
});
