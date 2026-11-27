import { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { spacing, type ThemeColors } from '@/theme/tokens';

const MODAL_EDGES = ['left', 'right'] as const;

export interface ModalFormLayoutProps {
  children: ReactNode;
  footer?: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardAvoiding: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
}));

export function ModalFormLayout({
  children,
  footer,
  contentContainerStyle,
}: ModalFormLayoutProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, spacing.lg);

  return (
    <SafeAreaView edges={MODAL_EDGES} style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 56 : 0}
      >
        <ScrollView
          style={styles.scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scrollContent,
            !footer && { paddingBottom: bottomPadding },
            contentContainerStyle,
          ]}
        >
          {children}
        </ScrollView>

        {footer ? (
          <View style={[styles.footer, { paddingBottom: bottomPadding }]}>
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
