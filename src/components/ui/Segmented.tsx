import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors, motion, radius, spacing } from '@/theme/tokens';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

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

interface SegmentItemProps {
  label: string;
  accessibilityLabel?: string;
  selected: boolean;
  disabled: boolean;
  compact: boolean;
  onPress: () => void;
}

function SegmentItem({
  label,
  accessibilityLabel,
  selected,
  disabled,
  compact,
  onPress,
}: SegmentItemProps) {
  const [pressScale] = useState(() => new Animated.Value(1));

  const animatePress = (toValue: number, duration: number) => {
    Animated.timing(pressScale, {
      toValue,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => {
        if (!disabled) {
          animatePress(0.96, motion.pressIn);
        }
      }}
      onPressOut={() => animatePress(1, motion.pressOut)}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        styles.segment,
        compact && styles.segmentCompact,
        pressed && !disabled && !selected && styles.segmentPressedIdle,
      ]}
    >
      <Animated.View
        style={[
          styles.labelWrapper,
          { transform: [{ scale: pressScale }] },
        ]}
      >
        <AppText
          variant={compact ? 'caption' : 'label'}
          tone={selected ? 'onAccent' : 'default'}
          numberOfLines={1}
          style={[styles.label, selected && styles.labelSelected]}
        >
          {label}
        </AppText>
      </Animated.View>
    </Pressable>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  disabled = false,
  compact = false,
  style,
}: SegmentedProps<T>) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [thumbX] = useState(() => new Animated.Value(0));
  const hasPositionedRef = useRef(false);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const count = options.length;
  const segmentWidth = count > 0 ? trackWidth / count : 0;

  useEffect(() => {
    if (segmentWidth <= 0 || selectedIndex < 0) {
      return;
    }

    const targetX = selectedIndex * segmentWidth;

    if (!hasPositionedRef.current) {
      hasPositionedRef.current = true;
      thumbX.setValue(targetX);
      return;
    }

    const anim = Animated.timing(thumbX, {
      toValue: targetX,
      duration: motion.transition,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    });
    anim.start();

    return () => {
      anim.stop();
    };
  }, [segmentWidth, selectedIndex, thumbX]);

  const handleTrackLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0 && nextWidth !== trackWidth) {
      setTrackWidth(nextWidth);
    }
  };

  return (
    <View
      style={[styles.container, disabled && styles.disabled, style]}
      accessibilityRole="radiogroup"
    >
      <View style={styles.track} onLayout={handleTrackLayout}>
        {segmentWidth > 0 && selectedIndex >= 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.thumb,
              {
                width: segmentWidth,
                transform: [{ translateX: thumbX }],
              },
            ]}
          />
        ) : null}

        {options.map((option) => {
          const selected = option.value === value;
          return (
            <SegmentItem
              key={String(option.value)}
              label={option.label}
              accessibilityLabel={option.accessibilityLabel}
              selected={selected}
              disabled={disabled}
              compact={compact}
              onPress={() => {
                if (!disabled && !selected) {
                  onChange(option.value);
                }
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 46,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    padding: 3,
  },
  disabled: {
    opacity: 0.55,
  },
  track: {
    flex: 1,
    flexDirection: 'row',
    position: 'relative',
  },
  thumb: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 0,
    backgroundColor: colors.accent,
    borderRadius: radius.small,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: Platform.OS === 'ios' ? 0.12 : 0,
    shadowRadius: 2,
  },
  segment: {
    flex: 1,
    zIndex: 1,
    minHeight: 38,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentCompact: {
    paddingHorizontal: spacing.xs,
  },
  segmentPressedIdle: {
    backgroundColor: colors.accentSoft,
  },
  labelWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '500',
  },
  labelSelected: {
    fontWeight: '600',
  },
});
