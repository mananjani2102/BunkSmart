import { isRunningInExpoGo } from 'expo';
import {
  AndroidImportance,
  IosAuthorizationStatus,
  PermissionStatus,
  SchedulableTriggerInputTypes,
  cancelAllScheduledNotificationsAsync,
  getExactAlarmPermissionsAsync,
  getPermissionsAsync,
  requestExactAlarmPermissionsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
  type NotificationPermissionsStatus,
} from 'expo-notifications';
import { Platform } from 'react-native';

import {
  formatTime12Hour,
  isoWeekdayToNotificationWeekday,
  timeStringToMinutes,
} from '@/lib/dates';
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

if (Platform.OS !== 'web') {
  setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  try {
    await setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
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

  const settings = await getPermissionsAsync();
  return isPermissionGranted(settings);
}

export async function requestReminderPermission(): Promise<ReminderPermissionResult> {
  if (Platform.OS === 'web') {
    return 'denied';
  }

  await ensureAndroidChannel();

  const existing = await getPermissionsAsync();
  if (isPermissionGranted(existing)) {
    return 'granted';
  }

  if (!existing.canAskAgain) {
    return 'denied';
  }

  const requested = await requestPermissionsAsync();
  return isPermissionGranted(requested) ? 'granted' : 'denied';
}

export async function getExactAlarmPermissionState(): Promise<ExactAlarmPermissionState> {
  if (Platform.OS !== 'android') {
    return { granted: true, canAskAgain: true };
  }

  try {
    const response = await getExactAlarmPermissionsAsync();
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

  const existing = await getExactAlarmPermissionState();
  if (existing.granted || !existing.canAskAgain) {
    return existing;
  }

  try {
    const requested = await requestExactAlarmPermissionsAsync();
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

  await runSerialized(async () => {
    await cancelAllScheduledNotificationsAsync();
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

  await runSerialized(async () => {
    await ensureAndroidChannel();
    await cancelAllScheduledNotificationsAsync();

    const subjectById: Record<string, Subject> = {};
    for (const subject of subjects) {
      subjectById[subject.id] = subject;
    }

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

      await scheduleNotificationAsync({
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
      });
    }
  });
}
