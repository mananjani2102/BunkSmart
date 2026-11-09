import { Linking, Pressable, StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Segmented, type SegmentedOption } from '@/components/ui/Segmented';
import { useReminders } from '@/context/RemindersProvider';
import { REMINDER_MINUTE_OPTIONS, type ReminderMinutes } from '@/lib/prefs';
import { colors, radius, spacing } from '@/theme/tokens';

const MINUTE_OPTIONS: readonly SegmentedOption<ReminderMinutes>[] =
  REMINDER_MINUTE_OPTIONS.map((minutes) => ({
    label: `${minutes} min`,
    value: minutes,
    accessibilityLabel: `${minutes} minutes before class`,
  }));

export interface RemindersCardProps {
  disabled?: boolean;
}

export function RemindersCard({ disabled = false }: RemindersCardProps) {
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

  const controlsDisabled = disabled || !loaded || busy;

  const handleOpenSettings = () => {
    void Linking.openSettings().catch(() => undefined);
  };

  return (
    <Card style={styles.card}>
      <AppText variant="heading">Class reminders</AppText>

      <View style={styles.switchRow}>
        <Pressable
          onPress={() => {
            if (!controlsDisabled) {
              void setEnabled(!settings.enabled);
            }
          }}
          disabled={controlsDisabled}
          accessibilityRole="switch"
          accessibilityLabel="Remind me before class"
          accessibilityState={{
            checked: settings.enabled,
            disabled: controlsDisabled,
          }}
          style={styles.switchLabelButton}
        >
          <AppText variant="label" style={styles.switchLabel}>
            Remind me before class
          </AppText>
        </Pressable>
        <Switch
          value={settings.enabled}
          onValueChange={(nextValue) => {
            void setEnabled(nextValue);
          }}
          disabled={controlsDisabled}
          accessibilityLabel="Remind me before class"
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor={colors.surface}
        />
      </View>

      <View style={styles.minutesGroup}>
        <AppText variant="caption" tone="muted">
          Minutes before class
        </AppText>
        <Segmented
          options={MINUTE_OPTIONS}
          value={settings.minutesBefore}
          onChange={(nextMinutes) => {
            void setMinutesBefore(nextMinutes);
          }}
          disabled={controlsDisabled}
          compact
        />
      </View>

      {permissionDenied ? (
        <View style={styles.deniedBox} accessibilityRole="alert">
          <AppText variant="caption" tone="warn">
            Notifications are turned off for BunkSmart. Turn them on in system
            settings to get reminders.
          </AppText>
          <Button
            title="Open settings"
            variant="secondary"
            onPress={handleOpenSettings}
            style={styles.settingsButton}
          />
        </View>
      ) : settings.enabled && !exactAlarmGranted ? (
        <View style={styles.deniedBox} accessibilityRole="alert">
          <AppText variant="caption" tone="warn">
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

      {error ? (
        <AppText variant="caption" tone="danger" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}

      <AppText variant="caption" tone="muted">
        Reminders are scheduled on this device only.
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 44,
  },
  switchLabelButton: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  switchLabel: {
    color: colors.text,
  },
  minutesGroup: {
    gap: spacing.xs,
  },
  deniedBox: {
    backgroundColor: colors.warnBg,
    borderRadius: radius.control,
    padding: spacing.md,
    gap: spacing.md,
  },
  settingsButton: {
    alignSelf: 'flex-start',
  },
});
