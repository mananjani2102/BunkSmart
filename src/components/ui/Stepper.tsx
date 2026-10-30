import { Ionicons } from '@expo/vector-icons';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, radius, spacing } from '@/theme/tokens';

export interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  suffix?: string;
  disabled?: boolean;
  formatValue?: (value: number) => string;
  style?: StyleProp<ViewStyle>;
}

export function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix,
  disabled = false,
  formatValue,
  style,
}: StepperProps) {
  const canDecrease = !disabled && value > min;
  const canIncrease = !disabled && value < max;

  const displayValue = formatValue
    ? formatValue(value)
    : `${value}${suffix ?? ''}`;

  const handleDecrease = () => {
    if (!canDecrease) {
      return;
    }
    onChange(Math.max(min, value - step));
  };

  const handleIncrease = () => {
    if (!canIncrease) {
      return;
    }
    onChange(Math.min(max, value + step));
  };

  return (
    <View style={[styles.row, style]}>
      <AppText variant="label" style={styles.label}>
        {label}
      </AppText>

      <View style={styles.controls}>
        <PressableScale
          onPress={handleDecrease}
          disabled={!canDecrease}
          scaleTo={0.93}
          rippleColor={colors.rippleNeutral}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          accessibilityState={{ disabled: !canDecrease }}
          containerStyle={[
            styles.buttonContainer,
            !canDecrease && styles.buttonDisabled,
          ]}
          style={({ pressed }) => [
            styles.button,
            pressed && canDecrease && styles.buttonPressed,
          ]}
        >
          <Ionicons
            name="remove"
            size={20}
            color={canDecrease ? colors.text : colors.textMuted}
          />
        </PressableScale>

        <View style={styles.valueBox}>
          <AppText
            variant="body"
            style={styles.valueText}
            accessibilityLabel={`${label}: ${displayValue}`}
          >
            {displayValue}
          </AppText>
        </View>

        <PressableScale
          onPress={handleIncrease}
          disabled={!canIncrease}
          scaleTo={0.93}
          rippleColor={colors.rippleNeutral}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          accessibilityState={{ disabled: !canIncrease }}
          containerStyle={[
            styles.buttonContainer,
            !canIncrease && styles.buttonDisabled,
          ]}
          style={({ pressed }) => [
            styles.button,
            pressed && canIncrease && styles.buttonPressed,
          ]}
        >
          <Ionicons
            name="add"
            size={20}
            color={canIncrease ? colors.text : colors.textMuted}
          />
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 44,
  },
  label: {
    flex: 1,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  buttonContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: colors.surfaceMuted,
    opacity: 0.55,
  },
  buttonPressed: {
    backgroundColor: colors.surfacePressed,
  },
  valueBox: {
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
