import { View, type StyleProp, type ViewStyle } from 'react-native';

import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { type ThemeColors } from '@/theme/tokens';

export interface DividerProps {
  insetLeft?: number;
  style?: StyleProp<ViewStyle>;
}

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  line: {
    height: 1,
    backgroundColor: colors.border,
  },
}));

export function Divider({ insetLeft = 0, style }: DividerProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);

  return (
    <View
      style={[
        styles.line,
        insetLeft > 0 ? { marginLeft: insetLeft } : undefined,
        style,
      ]}
    />
  );
}
