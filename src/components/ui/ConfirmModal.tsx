import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { triggerDestructiveHaptic } from '@/lib/haptics';
import { useReduceMotion } from '@/lib/motion';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { radius, shadows, spacing, type ThemeColors } from '@/theme/tokens';

export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.scrim,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.popover,
    ...shadows.floating,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.destructiveBg,
    borderRadius: radius.control,
    padding: spacing.md,
  },
  errorIcon: {
    marginRight: spacing.sm,
    marginTop: 1,
  },
  errorText: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionBtn: {
    flex: 1,
  },
}));

/**
 * Cross-platform confirmation dialog that works consistently on Web, Android, and iOS.
 */
export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  error = null,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const reduceMotion = useReduceMotion();

  const handleDismiss = () => {
    if (!loading) {
      onCancel();
    }
  };

  const handleConfirmPress = () => {
    if (loading) {
      return;
    }
    if (destructive) {
      triggerDestructiveHaptic();
    }
    onConfirm();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={handleDismiss}
    >
      {visible ? (
        <View style={styles.overlay}>
          <Pressable
            style={styles.backdrop}
            onPress={handleDismiss}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={cancelLabel}
          />
          <Card style={styles.modalCard}>
            <AppText variant="heading">{title}</AppText>
            <AppText variant="body" tone="muted">
              {message}
            </AppText>

            {error ? (
              <View style={styles.errorBanner} accessibilityRole="alert">
                <Ionicons
                  name="alert-circle-outline"
                  size={18}
                  color={colors.destructiveText}
                  style={styles.errorIcon}
                />
                <AppText variant="caption" tone="danger" style={styles.errorText}>
                  {error}
                </AppText>
              </View>
            ) : null}

            <View style={styles.actions}>
              <Button
                title={cancelLabel}
                variant="secondary"
                disabled={loading}
                onPress={handleDismiss}
                style={styles.actionBtn}
              />
              <Button
                title={confirmLabel}
                variant={destructive ? 'destructive' : 'primary'}
                loading={loading}
                disabled={loading}
                onPress={handleConfirmPress}
                style={styles.actionBtn}
              />
            </View>
          </Card>
        </View>
      ) : null}
    </Modal>
  );
}
