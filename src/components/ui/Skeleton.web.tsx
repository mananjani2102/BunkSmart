import { useEffect } from 'react';
import {
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { radius, type ThemeColors } from '@/theme/tokens';

export interface SkeletonProps {
  width?: DimensionValue;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

const STYLE_ID = 'bunksmart-skeleton-web-style';

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  base: {
    backgroundColor: colors.secondary,
  },
}));

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
      @media (prefers-reduced-motion: reduce) {
        .bunksmart-skeleton {
          animation: none !important;
          opacity: 0.7;
        }
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
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);

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
