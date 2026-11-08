import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const REMINDER_MINUTE_OPTIONS = [5, 10, 15, 30] as const;

export type ReminderMinutes = (typeof REMINDER_MINUTE_OPTIONS)[number];

export interface ReminderSettings {
  enabled: boolean;
  minutesBefore: ReminderMinutes;
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: false,
  minutesBefore: 10,
};

function getReminderStorageKey(userId: string): string {
  return `bunksmart:reminders:${userId}`;
}

function isReminderMinutes(value: unknown): value is ReminderMinutes {
  return (
    typeof value === 'number' &&
    (REMINDER_MINUTE_OPTIONS as readonly number[]).includes(value)
  );
}

export async function readReminderSettings(
  userId: string
): Promise<ReminderSettings> {
  if (!userId || (typeof window === 'undefined' && Platform.OS === 'web')) {
    return { ...DEFAULT_REMINDER_SETTINGS };
  }

  try {
    const raw = await AsyncStorage.getItem(getReminderStorageKey(userId));
    if (!raw) {
      return { ...DEFAULT_REMINDER_SETTINGS };
    }

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_REMINDER_SETTINGS };
    }

    const record = parsed as Record<string, unknown>;
    const enabled =
      typeof record.enabled === 'boolean'
        ? record.enabled
        : DEFAULT_REMINDER_SETTINGS.enabled;
    const minutesBefore = isReminderMinutes(record.minutesBefore)
      ? record.minutesBefore
      : DEFAULT_REMINDER_SETTINGS.minutesBefore;

    return { enabled, minutesBefore };
  } catch {
    return { ...DEFAULT_REMINDER_SETTINGS };
  }
}

export async function writeReminderSettings(
  userId: string,
  settings: ReminderSettings
): Promise<void> {
  if (!userId || (typeof window === 'undefined' && Platform.OS === 'web')) {
    return;
  }

  const sanitized: ReminderSettings = {
    enabled: Boolean(settings.enabled),
    minutesBefore: isReminderMinutes(settings.minutesBefore)
      ? settings.minutesBefore
      : DEFAULT_REMINDER_SETTINGS.minutesBefore,
  };

  await AsyncStorage.setItem(
    getReminderStorageKey(userId),
    JSON.stringify(sanitized)
  );
}
