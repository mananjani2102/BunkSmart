import {
  Animated,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useSharedSkeletonOpacity } from '@/lib/motion';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { radius, type ThemeColors } from '@/theme/tokens';

export interface SkeletonProps {
  width?: DimensionValue;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  base: {
    backgroundColor: colors.secondary,
  },
}));

/**
 * Placeholder block driven by one shared native-driver pulse loop.
 */
export function Skeleton({
  width = '100%',
  height,
  borderRadius = radius.small,
  style,
}: SkeletonProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const opacity = useSharedSkeletonOpacity();

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[
        styles.base,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
}
