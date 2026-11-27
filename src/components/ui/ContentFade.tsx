import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { USE_NATIVE_DRIVER, useReduceMotion } from '@/lib/motion';
import { motion } from '@/theme/tokens';

export interface ContentFadeProps {
  loading: boolean;
  fallback?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Renders `fallback` while `loading` is true and fades `children` in over
 * 150 ms using opacity with the native driver when data arrives. If content is
 * already ready on mount, renders immediately with no fade.
 */
export function ContentFade({
  loading,
  fallback = null,
  children,
  style,
}: ContentFadeProps) {
  const [opacity] = useState(() => new Animated.Value(loading ? 0 : 1));
  const wasLoadingRef = useRef(loading);
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (loading) {
      wasLoadingRef.current = true;
      opacity.setValue(0);
      return;
    }

    if (!wasLoadingRef.current) {
      opacity.setValue(1);
      return;
    }

    wasLoadingRef.current = false;

    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }

    opacity.setValue(0);
    const anim = Animated.timing(opacity, {
      toValue: 1,
      duration: motion.contentFade,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    });
    anim.start();

    return () => {
      anim.stop();
    };
  }, [loading, opacity, reduceMotion]);

  if (loading) {
    return <>{fallback}</>;
  }

  return (
    <Animated.View style={[{ opacity }, style]}>
      {children}
    </Animated.View>
  );
}
