import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  View,
} from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DATE_FORMAT_ERROR, DateField } from '@/components/ui/DateField';
import { getTodayDateString, parseTypedDate } from '@/lib/dates';
import { useReduceMotion } from '@/lib/motion';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { shadows, spacing, type ThemeColors } from '@/theme/tokens';

export interface GoToDateModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectDate: (dateStr: string) => void;
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

function GoToDateModalBody({
  onClose,
  onSelectDate,
}: Omit<GoToDateModalProps, 'visible'>) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const [dateText, setDateText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleGo = () => {
    const parsed = parseTypedDate(dateText);
    if (parsed === null) {
      setError(DATE_FORMAT_ERROR);
      return;
    }

    if (parsed > getTodayDateString()) {
      setError('You cannot mark future dates.');
      return;
    }

    onSelectDate(parsed);
    onClose();
  };

  return (
    <KeyboardAvoidingView
      style={styles.overlay}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close date picker"
      />
      <Card style={styles.modalCard}>
        <AppText variant="heading">Go to date</AppText>
        <DateField
          label="Date"
          value={dateText}
          onChangeText={(next) => {
            setDateText(next);
            if (error) {
              setError(null);
            }
          }}
          error={error ?? undefined}
        />
        <View style={styles.actions}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={onClose}
            style={styles.actionBtn}
          />
          <Button
            title="Go"
            onPress={handleGo}
            style={styles.actionBtn}
          />
        </View>
      </Card>
    </KeyboardAvoidingView>
  );
}

export function GoToDateModal({
  visible,
  onClose,
  onSelectDate,
}: GoToDateModalProps) {
  const reduceMotion = useReduceMotion();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
    >
      {visible ? (
        <GoToDateModalBody onClose={onClose} onSelectDate={onSelectDate} />
      ) : null}
    </Modal>
  );
}
