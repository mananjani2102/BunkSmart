import { Ionicons } from '@expo/vector-icons';
import {
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
  layout?: 'row' | 'column';
  style?: StyleProp<ViewStyle>;
}

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 44,
  },
  column: {
    gap: spacing.xs,
    alignItems: 'flex-start',
  },
  label: {
    flex: 1,
  },
  columnLabel: {
    width: '100%',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  controlsCompact: {
    gap: spacing.xs,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  buttonDisabled: {
    backgroundColor: colors.muted,
    opacity: 0.5,
  },
  buttonPressed: {
    backgroundColor: colors.muted,
    opacity: 0.85,
  },
  valueBox: {
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueBoxCompact: {
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    fontFamily: fontFamily.semibold,
    fontVariant: ['tabular-nums'],
  },
}));

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
  layout = 'row',
  style,
}: StepperProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const isColumn = layout === 'column';

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
    <View style={[isColumn ? styles.column : styles.row, style]}>
      <AppText
        variant="label"
        numberOfLines={2}
        style={isColumn ? styles.columnLabel : styles.label}
      >
        {label}
      </AppText>

      <View style={[styles.controls, isColumn && styles.controlsCompact]}>
        <Pressable
          onPress={handleDecrease}
          disabled={!canDecrease}
          android_ripple={
            canDecrease
              ? { color: colors.rippleNeutral, foreground: true }
              : undefined
          }
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          accessibilityState={{ disabled: !canDecrease }}
          style={({ pressed }) => [
            styles.button,
            !canDecrease && styles.buttonDisabled,
            pressed && canDecrease && styles.buttonPressed,
          ]}
        >
          <Ionicons
            name="remove"
            size={20}
            color={canDecrease ? colors.foreground : colors.mutedForeground}
          />
        </Pressable>

        <View style={isColumn ? styles.valueBoxCompact : styles.valueBox}>
          <AppText
            variant="body"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={styles.valueText}
            accessibilityLabel={`${label}: ${displayValue}`}
          >
            {displayValue}
          </AppText>
        </View>

        <Pressable
          onPress={handleIncrease}
          disabled={!canIncrease}
          android_ripple={
            canIncrease
              ? { color: colors.rippleNeutral, foreground: true }
              : undefined
          }
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          accessibilityState={{ disabled: !canIncrease }}
          style={({ pressed }) => [
            styles.button,
            !canIncrease && styles.buttonDisabled,
            pressed && canIncrease && styles.buttonPressed,
          ]}
        >
          <Ionicons
            name="add"
            size={20}
            color={canIncrease ? colors.foreground : colors.mutedForeground}
          />
        </Pressable>
      </View>
    </View>
  );
}
