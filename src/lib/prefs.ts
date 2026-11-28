import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { type ThemeMode } from '@/theme/tokens';

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

export const THEME_MODE_STORAGE_KEY = 'bunksmart:theme-mode';
const BUNKSMART_STORAGE_PREFIX = 'bunksmart:';
const PROFILE_CACHE_PREFIX = 'bunksmart:profile:';
const DATA_CACHE_PREFIX = 'bunksmart:data:';
const REMINDERS_STORAGE_PREFIX = 'bunksmart:reminders:';
const OVERVIEW_BASELINE_HINT_PREFIX =
  'bunksmart:overview-baseline-hint-dismissed:';

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

export async function readThemeMode(): Promise<ThemeMode> {
  if (typeof window === 'undefined' && Platform.OS === 'web') {
    return 'system';
  }

  try {
    const raw = await AsyncStorage.getItem(THEME_MODE_STORAGE_KEY);
    return isThemeMode(raw) ? raw : 'system';
  } catch {
    return 'system';
  }
}

export async function writeThemeMode(mode: ThemeMode): Promise<void> {
  if (typeof window === 'undefined' && Platform.OS === 'web') {
    return;
  }

  try {
    await AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore storage write errors.
  }
}

export function getProfileCacheKey(userId: string): string {
  return `${PROFILE_CACHE_PREFIX}${userId}`;
}

export function getDataCacheKey(userId: string): string {
  return `${DATA_CACHE_PREFIX}${userId}`;
}

function getReminderStorageKey(userId: string): string {
  return `${REMINDERS_STORAGE_PREFIX}${userId}`;
}

function getOverviewBaselineHintKey(userId: string): string {
  return `${OVERVIEW_BASELINE_HINT_PREFIX}${userId}`;
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

export async function readOverviewBaselineHintDismissed(
  userId: string
): Promise<boolean> {
  if (!userId || (typeof window === 'undefined' && Platform.OS === 'web')) {
    return false;
  }

  try {
    const raw = await AsyncStorage.getItem(getOverviewBaselineHintKey(userId));
    return raw === 'true';
  } catch {
    return false;
  }
}

export async function writeOverviewBaselineHintDismissed(
  userId: string,
  dismissed: boolean
): Promise<void> {
  if (!userId || (typeof window === 'undefined' && Platform.OS === 'web')) {
    return;
  }

  try {
    await AsyncStorage.setItem(
      getOverviewBaselineHintKey(userId),
      dismissed ? 'true' : 'false'
    );
  } catch {
    // Ignore storage write errors.
  }
}

export async function clearUserStorage(userId?: string | null): Promise<void> {
  if (typeof window === 'undefined' && Platform.OS === 'web') {
    return;
  }

  const keysToRemove = new Set<string>();
  if (userId) {
    keysToRemove.add(getProfileCacheKey(userId));
    keysToRemove.add(getDataCacheKey(userId));
    keysToRemove.add(getReminderStorageKey(userId));
    keysToRemove.add(getOverviewBaselineHintKey(userId));
  }

  try {
    const allKeys = await AsyncStorage.getAllKeys();
    for (const key of allKeys) {
      if (
        key.startsWith(BUNKSMART_STORAGE_PREFIX) &&
        key !== THEME_MODE_STORAGE_KEY
      ) {
        keysToRemove.add(key);
      }
    }
  } catch {
    // Keep known user-scoped keys if enumerating all keys fails.
  }

  if (keysToRemove.size === 0) {
    return;
  }

  const targetKeys = Array.from(keysToRemove);
  try {
    await AsyncStorage.multiRemove(targetKeys);
  } catch {
    await Promise.allSettled(
      targetKeys.map((key) => AsyncStorage.removeItem(key))
    );
  }
}
