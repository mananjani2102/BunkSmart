import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { motion } from '@/theme/tokens';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export interface FadeViewProps {
  children: ReactNode;
  transitionKey: string | number;
  style?: StyleProp<ViewStyle>;
}

export function FadeView({ children, transitionKey, style }: FadeViewProps) {
  const [opacity] = useState(() => new Animated.Value(1));
  const [translateY] = useState(() => new Animated.Value(0));
  const prevKeyRef = useRef(transitionKey);

  useEffect(() => {
    if (prevKeyRef.current === transitionKey) {
      return;
    }
    prevKeyRef.current = transitionKey;

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
  }, [opacity, transitionKey, translateY]);

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
