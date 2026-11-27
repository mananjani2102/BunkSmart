import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Linking, Platform, Pressable, Switch, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { Segmented, type SegmentedOption } from '@/components/ui/Segmented';
import { useReminders } from '@/context/RemindersProvider';
import { useSnackbarActions } from '@/context/SnackbarProvider';
import { REMINDER_MINUTE_OPTIONS, type ReminderMinutes } from '@/lib/prefs';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { fontFamily, radius, spacing, type ThemeColors } from '@/theme/tokens';

const MINUTE_OPTIONS: readonly SegmentedOption<ReminderMinutes>[] =
  REMINDER_MINUTE_OPTIONS.map((minutes) => ({
    label: `${minutes} min`,
    value: minutes,
    accessibilityLabel: `${minutes} minutes before class`,
  }));

export interface RemindersCardProps {
  disabled?: boolean;
}

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  groupedCard: {
    padding: 0,
    overflow: 'hidden',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  switchLabelButton: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radius.small,
    paddingHorizontal: spacing.xs,
  },
  switchLabelPressed: {
    backgroundColor: colors.muted,
  },
  switchTitle: {
    fontFamily: fontFamily.medium,
  },
  minutesRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  webInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.muted,
    borderRadius: radius.control,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  infoIcon: {
    marginTop: 1,
  },
  infoText: {
    flex: 1,
  },
  deniedBox: {
    backgroundColor: colors.warningBg,
    borderRadius: radius.control,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  settingsButton: {
    alignSelf: 'flex-start',
  },
  errorText: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
}));

export function RemindersCard({ disabled = false }: RemindersCardProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);

  const {
    settings,
    loaded,
    busy,
    permissionDenied,
    exactAlarmGranted,
    exactAlarmCanAsk,
    error,
    setEnabled,
    setMinutesBefore,
    allowExactAlarms,
  } = useReminders();
  const { showSnackbar } = useSnackbarActions();
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const isWeb = Platform.OS === 'web';
  const canOpenSettings =
    !isWeb && typeof Linking?.openSettings === 'function';
  const controlsDisabled = disabled || isWeb || !loaded || busy;
  const displayError = error ?? settingsError;

  const handleOpenSettings = () => {
    if (!canOpenSettings) {
      setSettingsError(
        'Open device settings to turn on notifications for BunkSmart.'
      );
      return;
    }

    setSettingsError(null);
    try {
      void Promise.resolve(Linking.openSettings()).catch(() => {
        setSettingsError('Unable to open device settings from here.');
      });
    } catch {
      setSettingsError('Unable to open device settings from here.');
    }
  };

  const handleToggleReminders = async (nextValue: boolean) => {
    setSettingsError(null);
    const saved = await setEnabled(nextValue);
    if (saved) {
      showSnackbar(
        nextValue ? 'Class reminders turned on.' : 'Class reminders turned off.'
      );
    }
  };

  const handleChangeMinutes = async (nextMinutes: ReminderMinutes) => {
    const saved = await setMinutesBefore(nextMinutes);
    if (saved) {
      showSnackbar(`Reminder lead time saved (${nextMinutes} min).`);
    } else {
      showSnackbar({
        message: 'Could not save reminder lead time.',
        tone: 'error',
      });
    }
  };

  return (
    <Card style={styles.groupedCard}>
      <View style={styles.switchRow}>
        <Pressable
          onPress={() => {
            if (!controlsDisabled) {
              void handleToggleReminders(!settings.enabled);
            }
          }}
          disabled={controlsDisabled}
          android_ripple={
            !controlsDisabled
              ? { color: colors.rippleNeutral, foreground: true }
              : undefined
          }
          accessibilityRole="switch"
          accessibilityLabel="Class reminders"
          accessibilityState={{
            checked: isWeb ? false : settings.enabled,
            disabled: controlsDisabled,
          }}
          style={({ pressed }) => [
            styles.switchLabelButton,
            pressed && !controlsDisabled && styles.switchLabelPressed,
          ]}
        >
          <AppText variant="body" style={styles.switchTitle}>
            Class reminders
          </AppText>
        </Pressable>
        <Switch
          value={isWeb ? false : settings.enabled}
          onValueChange={(nextValue) => {
            void handleToggleReminders(nextValue);
          }}
          disabled={controlsDisabled}
          accessibilityLabel="Class reminders"
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.primaryForeground}
        />
      </View>

      <Divider />

      <View style={styles.minutesRow}>
        <AppText variant="caption" tone="muted">
          Minutes before class
        </AppText>
        <Segmented
          options={MINUTE_OPTIONS}
          value={settings.minutesBefore}
          onChange={(nextMinutes) => {
            void handleChangeMinutes(nextMinutes);
          }}
          disabled={controlsDisabled}
          compact
        />
      </View>

      {isWeb ? (
        <View style={styles.webInfoBox}>
          <Ionicons
            name="phone-portrait-outline"
            size={18}
            color={colors.mutedForeground}
            style={styles.infoIcon}
          />
          <AppText variant="caption" tone="muted" style={styles.infoText}>
            Class reminders are available on the Android and iOS app, not in a
            web browser.
          </AppText>
        </View>
      ) : permissionDenied ? (
        <View style={styles.deniedBox} accessibilityRole="alert">
          <AppText variant="caption" tone="warning">
            Notifications are turned off for BunkSmart. Turn them on in system
            settings to get reminders.
          </AppText>
          {canOpenSettings ? (
            <Button
              title="Open settings"
              variant="secondary"
              onPress={handleOpenSettings}
              style={styles.settingsButton}
            />
          ) : null}
        </View>
      ) : settings.enabled && !exactAlarmGranted ? (
        <View style={styles.deniedBox} accessibilityRole="alert">
          <AppText variant="caption" tone="warning">
            {exactAlarmCanAsk
              ? 'Allow Alarms and reminders in settings so reminders arrive on time.'
              : 'Exact alarms are unavailable here, so Android may deliver reminders a few minutes late.'}
          </AppText>
          {exactAlarmCanAsk ? (
            <Button
              title="Allow exact reminders"
              variant="secondary"
              disabled={controlsDisabled}
              onPress={() => {
                void allowExactAlarms();
              }}
              style={styles.settingsButton}
            />
          ) : null}
        </View>
      ) : null}

      {displayError ? (
        <AppText
          variant="caption"
          tone="danger"
          accessibilityRole="alert"
          style={styles.errorText}
        >
          {displayError}
        </AppText>
      ) : null}
    </Card>
  );
}
