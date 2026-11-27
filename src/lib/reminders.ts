import { PermissionStatus, isRunningInExpoGo } from 'expo';
import { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
import {
  IosAuthorizationStatus,
  type NotificationPermissionsStatus,
} from 'expo-notifications/build/NotificationPermissions.types';
import { SchedulableTriggerInputTypes } from 'expo-notifications/build/Notifications.types';
import { Platform } from 'react-native';

import {
  formatTime12Hour,
  isoWeekdayToNotificationWeekday,
  timeStringToMinutes,
} from '@/lib/dates';
import { AppError } from '@/lib/errors';
import { type ReminderMinutes } from '@/lib/prefs';
import { type Subject, type TimetableSlot } from '@/types/db';

export const REMINDER_CHANNEL_ID = 'class-reminders';
const REMINDER_CHANNEL_NAME = 'Class reminders';
const MINUTES_PER_DAY = 24 * 60;

export type ReminderPermissionResult = 'granted' | 'denied';

export interface ExactAlarmPermissionState {
  granted: boolean;
  canAskAgain: boolean;
}

interface LocalNotificationsApi {
  getPermissionsAsync: typeof import('expo-notifications/build/NotificationPermissions').getPermissionsAsync;
  requestPermissionsAsync: typeof import('expo-notifications/build/NotificationPermissions').requestPermissionsAsync;
  getExactAlarmPermissionsAsync: typeof import('expo-notifications/build/NotificationPermissions').getExactAlarmPermissionsAsync;
  requestExactAlarmPermissionsAsync: typeof import('expo-notifications/build/NotificationPermissions').requestExactAlarmPermissionsAsync;
  setNotificationChannelAsync: typeof import('expo-notifications/build/setNotificationChannelAsync').setNotificationChannelAsync;
  scheduleNotificationAsync: typeof import('expo-notifications/build/scheduleNotificationAsync').scheduleNotificationAsync;
  cancelAllScheduledNotificationsAsync: typeof import('expo-notifications/build/cancelAllScheduledNotificationsAsync').cancelAllScheduledNotificationsAsync;
}

let cachedApi: LocalNotificationsApi | null = null;
let loadingApiPromise: Promise<LocalNotificationsApi | null> | null = null;
let handlerConfigured = false;

/**
 * Loads only the local-notification submodules from `expo-notifications` so
 * `getExpoPushTokenAsync` (and its native `ExpoApplication` dependency) is
 * never imported or evaluated in Expo Go.
 */
async function loadLocalNotifications(): Promise<LocalNotificationsApi | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  if (cachedApi) {
    return cachedApi;
  }

  if (!loadingApiPromise) {
    loadingApiPromise = (async () => {
      try {
        const [
          handlerMod,
          permissionsMod,
          channelMod,
          scheduleMod,
          cancelMod,
        ] = await Promise.all([
          import('expo-notifications/build/NotificationsHandler'),
          import('expo-notifications/build/NotificationPermissions'),
          import('expo-notifications/build/setNotificationChannelAsync'),
          import('expo-notifications/build/scheduleNotificationAsync'),
          import(
            'expo-notifications/build/cancelAllScheduledNotificationsAsync'
          ),
        ]);

        if (!handlerConfigured) {
          handlerMod.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowBanner: true,
              shouldShowList: true,
              shouldPlaySound: false,
              shouldSetBadge: false,
            }),
          });
          handlerConfigured = true;
        }

        cachedApi = {
          getPermissionsAsync: permissionsMod.getPermissionsAsync,
          requestPermissionsAsync: permissionsMod.requestPermissionsAsync,
          getExactAlarmPermissionsAsync:
            permissionsMod.getExactAlarmPermissionsAsync,
          requestExactAlarmPermissionsAsync:
            permissionsMod.requestExactAlarmPermissionsAsync,
          setNotificationChannelAsync: channelMod.setNotificationChannelAsync,
          scheduleNotificationAsync: scheduleMod.scheduleNotificationAsync,
          cancelAllScheduledNotificationsAsync:
            cancelMod.cancelAllScheduledNotificationsAsync,
        };

        return cachedApi;
      } catch {
        loadingApiPromise = null;
        return null;
      }
    })();
  }

  return loadingApiPromise;
}

async function ensureAndroidChannel(api: LocalNotificationsApi): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  try {
    await api.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: REMINDER_CHANNEL_NAME,
      importance: AndroidImportance.HIGH,
    });
  } catch {
    // Expo Go on Android can reject channel creation with a native NPE;
    // continue so permission prompts and fallback-channel scheduling still run.
  }
}

function isPermissionGranted(
  response: NotificationPermissionsStatus
): boolean {
  if (response.granted || response.status === PermissionStatus.GRANTED) {
    return true;
  }

  if (
    Platform.OS === 'ios' &&
    response.ios?.status === IosAuthorizationStatus.PROVISIONAL
  ) {
    return true;
  }

  if (
    Platform.OS === 'android' &&
    isRunningInExpoGo() &&
    typeof response.android?.importance === 'number' &&
    response.android.importance !== 0
  ) {
    return true;
  }

  return false;
}

export async function hasReminderPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  const api = await loadLocalNotifications();
  if (!api) {
    return false;
  }

  const settings = await api.getPermissionsAsync();
  return isPermissionGranted(settings);
}

export async function requestReminderPermission(): Promise<ReminderPermissionResult> {
  if (Platform.OS === 'web') {
    return 'denied';
  }

  const api = await loadLocalNotifications();
  if (!api) {
    throw new AppError(
      'Class reminders are unavailable in this Expo Go build. Use an Android APK build to enable reminders.'
    );
  }

  const [, existing] = await Promise.all([
    ensureAndroidChannel(api),
    api.getPermissionsAsync(),
  ]);
  if (isPermissionGranted(existing)) {
    return 'granted';
  }

  if (!existing.canAskAgain) {
    return 'denied';
  }

  const requested = await api.requestPermissionsAsync();
  return isPermissionGranted(requested) ? 'granted' : 'denied';
}

export async function getExactAlarmPermissionState(): Promise<ExactAlarmPermissionState> {
  if (Platform.OS !== 'android') {
    return { granted: true, canAskAgain: true };
  }

  const api = await loadLocalNotifications();
  if (!api) {
    return { granted: true, canAskAgain: false };
  }

  try {
    const response = await api.getExactAlarmPermissionsAsync();
    return {
      granted: Boolean(response.granted),
      canAskAgain: Boolean(response.canAskAgain),
    };
  } catch {
    return { granted: false, canAskAgain: false };
  }
}

export async function requestExactAlarmPermission(): Promise<ExactAlarmPermissionState> {
  if (Platform.OS !== 'android') {
    return { granted: true, canAskAgain: true };
  }

  const api = await loadLocalNotifications();
  if (!api) {
    return { granted: true, canAskAgain: false };
  }

  const existing = await getExactAlarmPermissionState();
  if (existing.granted || !existing.canAskAgain) {
    return existing;
  }

  try {
    const requested = await api.requestExactAlarmPermissionsAsync();
    return {
      granted: Boolean(requested.granted),
      canAskAgain: Boolean(requested.canAskAgain),
    };
  } catch {
    return getExactAlarmPermissionState();
  }
}

let reminderQueue: Promise<void> = Promise.resolve();

function runSerialized(task: () => Promise<void>): Promise<void> {
  const next = reminderQueue.then(task, task);
  reminderQueue = next.catch(() => undefined);
  return next;
}

export async function cancelAllClassReminders(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const api = await loadLocalNotifications();
  if (!api) {
    return;
  }

  await runSerialized(async () => {
    await api.cancelAllScheduledNotificationsAsync();
  });
}

export async function rescheduleClassReminders(
  slots: readonly TimetableSlot[],
  subjects: readonly Subject[],
  minutesBefore: ReminderMinutes
): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const api = await loadLocalNotifications();
  if (!api) {
    return;
  }

  await runSerialized(async () => {
    await Promise.all([
      ensureAndroidChannel(api),
      api.cancelAllScheduledNotificationsAsync(),
    ]);

    const subjectById: Record<string, Subject> = {};
    for (const subject of subjects) {
      subjectById[subject.id] = subject;
    }

    const scheduleTasks: Promise<string>[] = [];

    for (const slot of slots) {
      const subject = subjectById[slot.subject_id];
      if (!subject) {
        continue;
      }

      const startMinutes = timeStringToMinutes(slot.start_time);
      let reminderMinutes = startMinutes - minutesBefore;
      let isoWeekday = slot.weekday;

      if (reminderMinutes < 0) {
        reminderMinutes += MINUTES_PER_DAY;
        isoWeekday = isoWeekday === 1 ? 7 : isoWeekday - 1;
      }

      const hour = Math.floor(reminderMinutes / 60);
      const minute = reminderMinutes % 60;
      const weekday = isoWeekdayToNotificationWeekday(isoWeekday);
      const startLabel = formatTime12Hour(slot.start_time);

      scheduleTasks.push(
        api.scheduleNotificationAsync({
          content: {
            title: `${subject.name} at ${startLabel}`,
            body: `Starts in ${minutesBefore} minutes.`,
            sound: false,
          },
          trigger: {
            type: SchedulableTriggerInputTypes.WEEKLY,
            channelId: REMINDER_CHANNEL_ID,
            weekday,
            hour,
            minute,
            delivery: 'bestEffort',
          },
        })
      );
    }

    if (scheduleTasks.length > 0) {
      await Promise.all(scheduleTasks);
    }
  });
}
