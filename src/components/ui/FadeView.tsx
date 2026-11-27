import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { USE_NATIVE_DRIVER, useReduceMotion } from '@/lib/motion';
import { motion } from '@/theme/tokens';

export interface FadeViewProps {
  children: ReactNode;
  transitionKey: string | number;
  style?: StyleProp<ViewStyle>;
}

export function FadeView({ children, transitionKey, style }: FadeViewProps) {
  const [opacity] = useState(() => new Animated.Value(1));
  const [translateY] = useState(() => new Animated.Value(0));
  const prevKeyRef = useRef(transitionKey);
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (prevKeyRef.current === transitionKey) {
      return;
    }
    prevKeyRef.current = transitionKey;

    if (reduceMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    opacity.setValue(0.35);
    translateY.setValue(4);

    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: motion.transition,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: motion.transition,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]);

    anim.start();

    return () => {
      anim.stop();
    };
  }, [opacity, reduceMotion, transitionKey, translateY]);

  return (
    <Animated.View
      style={[
        {
          opacity,
          transform: [{ translateY }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
