import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

export interface BrandMarkProps {
  size?: number;
}

const DEFAULT_SIZE = 36;

/**
 * Monochrome square app mark with a centered vector check mark that adapts
 * automatically to the active light or dark theme.
 */
export const BrandMark = memo(function BrandMark({
  size = DEFAULT_SIZE,
}: BrandMarkProps) {
  const { colors } = useTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[
        styles.container,
        {
          width: size,
          height: size,
          backgroundColor: colors.primary,
        },
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 36 36">
        <Path
          d="M 9 18.75 L 14.5 24.25 L 27 11.75"
          stroke={colors.primaryForeground}
          strokeWidth={2.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
