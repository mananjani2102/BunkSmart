import { type ReminderMinutes } from '@/lib/prefs';
import { type Subject, type TimetableSlot } from '@/types/db';

export const REMINDER_CHANNEL_ID = 'class-reminders';

export type ReminderPermissionResult = 'granted' | 'denied';

export interface ExactAlarmPermissionState {
  granted: boolean;
  canAskAgain: boolean;
}

export async function hasReminderPermission(): Promise<boolean> {
  return false;
}

export async function requestReminderPermission(): Promise<ReminderPermissionResult> {
  return 'denied';
}

export async function getExactAlarmPermissionState(): Promise<ExactAlarmPermissionState> {
  return { granted: true, canAskAgain: true };
}

export async function requestExactAlarmPermission(): Promise<ExactAlarmPermissionState> {
  return { granted: true, canAskAgain: true };
}

export async function cancelAllClassReminders(): Promise<void> {
  return Promise.resolve();
}

export async function rescheduleClassReminders(
  _slots: readonly TimetableSlot[],
  _subjects: readonly Subject[],
  _minutesBefore: ReminderMinutes
): Promise<void> {
  return Promise.resolve();
}
