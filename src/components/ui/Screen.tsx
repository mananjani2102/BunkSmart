import { type ReactNode } from 'react';
import {
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { spacing, type ThemeColors } from '@/theme/tokens';

const DEFAULT_EDGES: readonly Edge[] = ['top', 'left', 'right'];

export interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: readonly Edge[];
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  padded: {
    paddingHorizontal: spacing.lg,
  },
}));

export function Screen({
  children,
  scroll = false,
  padded = true,
  edges = DEFAULT_EDGES,
  style,
  contentContainerStyle,
}: ScreenProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);

  return (
    <SafeAreaView edges={edges} style={[styles.safeArea, style]}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scrollContent,
            padded && styles.padded,
            contentContainerStyle,
          ]}
        >
          {children}
        </ScrollView>
      ) : (
        <View
          style={[
            styles.content,
            padded && styles.padded,
            contentContainerStyle,
          ]}
        >
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}
