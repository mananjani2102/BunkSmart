import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import {
  fontFamily,
  radius,
  spacing,
  type ThemeColors,
} from '@/theme/tokens';

export interface SegmentedOption<T extends string | number> {
  label: string;
  value: T;
  accessibilityLabel?: string;
}

export interface SegmentedProps<T extends string | number> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  container: {
    minHeight: 48,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    padding: 3,
  },
  disabled: {
    opacity: 0.5,
  },
  track: {
    flex: 1,
    flexDirection: 'row',
    gap: 3,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.small,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  segmentCompact: {
    paddingHorizontal: 2,
  },
  segmentSelected: {
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  segmentPressedIdle: {
    backgroundColor: colors.secondary,
  },
  label: {
    fontFamily: fontFamily.medium,
    textAlign: 'center',
  },
}));

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  disabled = false,
  compact = false,
  style,
}: SegmentedProps<T>) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);

  return (
    <View
      style={[styles.container, disabled && styles.disabled, style]}
      accessibilityRole="radiogroup"
    >
      <View style={styles.track}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              onPress={() => {
                if (!disabled && !selected) {
                  onChange(option.value);
                }
              }}
              disabled={disabled}
              android_ripple={
                !disabled && !selected
                  ? { color: colors.rippleNeutral, foreground: true }
                  : undefined
              }
              accessibilityRole="radio"
              accessibilityLabel={option.accessibilityLabel ?? option.label}
              accessibilityState={{ selected, disabled }}
              style={({ pressed }) => [
                styles.segment,
                compact && styles.segmentCompact,
                selected && styles.segmentSelected,
                pressed && !disabled && !selected && styles.segmentPressedIdle,
              ]}
            >
              <AppText
                variant={compact ? 'caption' : 'label'}
                tone={selected ? 'default' : 'muted'}
                numberOfLines={compact ? 1 : 2}
                adjustsFontSizeToFit={compact}
                minimumFontScale={0.8}
                style={styles.label}
              >
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
