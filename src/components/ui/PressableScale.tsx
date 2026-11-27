import { type ReactNode, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { USE_NATIVE_DRIVER, useReduceMotion } from '@/lib/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { motion } from '@/theme/tokens';

export interface PressableScaleProps extends Omit<PressableProps, 'children'> {
  children: ReactNode;
  scaleTo?: number;
  rippleColor?: string | null;
  containerStyle?: StyleProp<ViewStyle>;
}

export function PressableScale({
  children,
  scaleTo = 0.975,
  rippleColor,
  containerStyle,
  disabled,
  onPressIn,
  onPressOut,
  style,
  ...rest
}: PressableScaleProps) {
  const { colors } = useTheme();
  const [scale] = useState(() => new Animated.Value(1));
  const reduceMotion = useReduceMotion();
  const resolvedRipple =
    rippleColor === undefined ? colors.rippleNeutral : rippleColor;

  const animateTo = (toValue: number, duration: number) => {
    if (reduceMotion) {
      scale.setValue(1);
      return;
    }
    Animated.timing(scale, {
      toValue,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  };

  const handlePressIn = (event: GestureResponderEvent) => {
    if (!disabled) {
      animateTo(scaleTo, motion.pressIn);
    }
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    animateTo(1, motion.pressOut);
    onPressOut?.(event);
  };

  const webCursor =
    Platform.OS === 'web' && !disabled ? ('pointer' as const) : undefined;

  return (
    <Animated.View
      style={[
        { transform: [{ scale }] },
        containerStyle,
      ]}
    >
      <Pressable
        disabled={disabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        android_ripple={
          resolvedRipple && !disabled
            ? { color: resolvedRipple, foreground: true }
            : undefined
        }
        style={(state) => [
          webCursor && ({ cursor: webCursor } as ViewStyle),
          typeof style === 'function' ? style(state) : style,
        ]}
        {...rest}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
