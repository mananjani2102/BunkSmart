export const SHORT_WEEKDAYS = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
] as const;

export const LONG_WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export const LONG_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TYPED_DATE_PATTERN = /^(\d{1,2})([/.\-])(\d{1,2})\2(\d{4})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}-${month}-${day}`;
}

export function getTodayDateString(): string {
  return formatDateString(new Date());
}

export function isValidDateString(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

export function parseDateString(dateStr: string): Date {
  if (!isValidDateString(dateStr)) {
    throw new Error(`Invalid local date string: ${dateStr}`);
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(dateStr: string, days: number): string {
  const date = parseDateString(dateStr);
  date.setDate(date.getDate() + days);
  return formatDateString(date);
}

export function getIsoWeekday(dateStr: string): number {
  const day = parseDateString(dateStr).getDay();
  return day === 0 ? 7 : day;
}

export function isoWeekdayToNotificationWeekday(isoWeekday: number): number {
  if (!Number.isInteger(isoWeekday) || isoWeekday < 1 || isoWeekday > 7) {
    throw new Error(`Invalid ISO weekday: ${isoWeekday}`);
  }

  return isoWeekday === 7 ? 1 : isoWeekday + 1;
}

export function timeStringToMinutes(timeStr: string): number {
  const match = TIME_PATTERN.exec(timeStr);
  if (!match) {
    throw new Error(`Invalid time string: ${timeStr}`);
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] !== undefined ? Number(match[3]) : 0;

  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    throw new Error(`Out of range time string: ${timeStr}`);
  }

  return hours * 60 + minutes;
}

export function minutesToTimeString(totalMinutes: number): string {
  if (
    !Number.isInteger(totalMinutes) ||
    totalMinutes < 0 ||
    totalMinutes >= 24 * 60
  ) {
    throw new Error(`Invalid minutes after midnight: ${totalMinutes}`);
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${pad2(hours)}:${pad2(minutes)}:00`;
}

export function formatTime12Hour(timeStr: string): string {
  const totalMinutes = timeStringToMinutes(timeStr);
  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${pad2(minutes)} ${period}`;
}

export function formatFriendlyDateLabel(
  dateStr: string,
  referenceDate: Date = new Date()
): string {
  const today = formatDateString(referenceDate);
  if (dateStr === today) {
    return 'Today';
  }

  const yesterday = addDays(today, -1);
  if (dateStr === yesterday) {
    return 'Yesterday';
  }

  const date = parseDateString(dateStr);
  const weekdayLabel = SHORT_WEEKDAYS[getIsoWeekday(dateStr) - 1];
  const monthLabel = SHORT_MONTHS[date.getMonth()];
  return `${weekdayLabel}, ${date.getDate()} ${monthLabel}`;
}

export function getMonthKey(dateStr: string): string {
  const date = parseDateString(dateStr);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

export function formatMonthYear(dateStr: string): string {
  const date = parseDateString(dateStr);
  const monthLabel = LONG_MONTHS[date.getMonth()];
  return `${monthLabel} ${date.getFullYear()}`;
}

export function parseTypedDate(raw: string): string | null {
  const trimmed = raw.trim();
  const match = TYPED_DATE_PATTERN.exec(trimmed);
  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[3]);
  const year = Number(match[4]);

  if (year < 1900 || year > 9999) {
    return null;
  }

  const candidate = `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
  return isValidDateString(candidate) ? candidate : null;
}

export function formatDateDDMMYYYY(dateStr: string): string {
  if (!isValidDateString(dateStr)) {
    throw new Error(`Invalid local date string: ${dateStr}`);
  }

  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function toUtcDayNumber(dateStr: string): number {
  if (!isValidDateString(dateStr)) {
    throw new Error(`Invalid local date string: ${dateStr}`);
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

export function countWeekdayOccurrences(
  startDateStr: string,
  endDateStr: string,
  isoWeekday: number
): number {
  if (!Number.isInteger(isoWeekday) || isoWeekday < 1 || isoWeekday > 7) {
    throw new Error(`Invalid ISO weekday: ${isoWeekday}`);
  }

  const startDayNum = toUtcDayNumber(startDateStr);
  const endDayNum = toUtcDayNumber(endDateStr);
  if (startDayNum > endDayNum) {
    return 0;
  }

  const totalDays = endDayNum - startDayNum + 1;
  const startWeekday = getIsoWeekday(startDateStr);
  const offset = (isoWeekday - startWeekday + 7) % 7;

  if (offset >= totalDays) {
    return 0;
  }

  return 1 + Math.floor((totalDays - 1 - offset) / 7);
}
