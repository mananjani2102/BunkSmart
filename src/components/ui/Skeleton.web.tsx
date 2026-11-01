import { useEffect } from 'react';
import {
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radius } from '@/theme/tokens';

export interface SkeletonProps {
  width?: DimensionValue;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

const STYLE_ID = 'bunksmart-skeleton-web-style';

function ensureWebStyles() {
  if (typeof document === 'undefined') {
    return;
  }
  if (!document.getElementById(STYLE_ID)) {
    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
      @keyframes bunkSkeletonPulse {
        0% { opacity: 0.45; }
        50% { opacity: 0.95; }
        100% { opacity: 0.45; }
      }
      .bunksmart-skeleton {
        animation: bunkSkeletonPulse 1.5s ease-in-out infinite !important;
        will-change: opacity;
        pointer-events: none;
      }
    `;
    document.head.appendChild(styleEl);
  }
}

export function Skeleton({
  width = '100%',
  height,
  borderRadius = radius.small,
  style,
}: SkeletonProps) {
  useEffect(() => {
    ensureWebStyles();
  }, []);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      // @ts-expect-error className is supported on react-native-web
      className="bunksmart-skeleton"
      style={[
        styles.base,
        {
          width,
          height,
          borderRadius,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surfaceMuted,
  },
});
