import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Divider } from '@/components/ui/Divider';
import { ListRow, type ListRowIconName } from '@/components/ui/ListRow';
import { useReduceMotion } from '@/lib/motion';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import {
  fontFamily,
  radius,
  shadows,
  spacing,
  type ThemeColors,
} from '@/theme/tokens';

export interface ActionSheetItem {
  label: string;
  subtitle?: string;
  icon?: ListRowIconName;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export interface ActionSheetProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  items: readonly ActionSheetItem[];
  onClose: () => void;
}

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.scrim,
  },
  sheet: {
    backgroundColor: colors.popover,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    overflow: 'hidden',
    ...shadows.floating,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: 2,
  },
  title: {
    fontFamily: fontFamily.semibold,
  },
}));

export function ActionSheet({
  visible,
  title,
  subtitle,
  items,
  onClose,
}: ActionSheetProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
    >
      {visible ? (
        <View style={styles.overlay}>
          <Pressable
            style={styles.backdrop}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
          />
          <View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, spacing.sm) },
            ]}
          >
            {title ? (
              <>
                <View style={styles.header}>
                  <AppText variant="heading" style={styles.title}>
                    {title}
                  </AppText>
                  {subtitle ? (
                    <AppText variant="caption" tone="muted">
                      {subtitle}
                    </AppText>
                  ) : null}
                </View>
                <Divider />
              </>
            ) : null}

            {items.map((item, index) => (
              <View key={item.label}>
                {index > 0 ? <Divider /> : null}
                <ListRow
                  title={item.label}
                  subtitle={item.subtitle}
                  icon={item.icon}
                  destructive={item.destructive}
                  disabled={item.disabled}
                  onPress={() => {
                    onClose();
                    item.onPress();
                  }}
                />
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </Modal>
  );
}
