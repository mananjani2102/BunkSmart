export type AttendanceLevel = 'no_data' | 'below' | 'borderline' | 'safe';
export type AttendanceTone = 'safe' | 'warn' | 'danger' | 'muted';

export interface AttendanceCounts {
  attended: number;
  held: number;
}

export function clampTarget(target: number): number {
  if (!Number.isFinite(target)) {
    return 75;
  }
  return Math.min(99, Math.max(1, Math.round(target)));
}

function normalizeNonNegativeInt(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
}

export function meetsTarget(
  attended: number,
  held: number,
  target: number
): boolean {
  const a = normalizeNonNegativeInt(attended);
  const h = normalizeNonNegativeInt(held);
  const t = clampTarget(target);

  if (h === 0) {
    return true;
  }

  return 100 * a >= t * h;
}

export function canSkip(
  attended: number,
  held: number,
  target: number
): number {
  const a = normalizeNonNegativeInt(attended);
  const h = normalizeNonNegativeInt(held);
  const t = clampTarget(target);

  if (h === 0) {
    return 0;
  }

  const surplus = 100 * a - t * h;
  if (surplus <= 0) {
    return 0;
  }

  return Math.floor(surplus / t);
}

export function mustAttend(
  attended: number,
  held: number,
  target: number
): number {
  const a = normalizeNonNegativeInt(attended);
  const h = normalizeNonNegativeInt(held);
  const t = clampTarget(target);

  if (h === 0) {
    return 0;
  }

  const need = t * h - 100 * a;
  if (need <= 0) {
    return 0;
  }

  const denominator = 100 - t;
  return Math.floor((need + denominator - 1) / denominator);
}

export function projectAttendance(
  attended: number,
  held: number,
  attendMore: number,
  skipMore: number
): AttendanceCounts {
  const a = normalizeNonNegativeInt(attended);
  const h = normalizeNonNegativeInt(held);
  const x = normalizeNonNegativeInt(attendMore);
  const y = normalizeNonNegativeInt(skipMore);

  return {
    attended: a + x,
    held: h + x + y,
  };
}

export function combineCounts(
  list: readonly AttendanceCounts[]
): AttendanceCounts {
  let attended = 0;
  let held = 0;

  for (const item of list) {
    attended += normalizeNonNegativeInt(item.attended);
    held += normalizeNonNegativeInt(item.held);
  }

  return { attended, held };
}

export function getPercentTenths(
  attended: number,
  held: number
): number | null {
  const a = normalizeNonNegativeInt(attended);
  const h = normalizeNonNegativeInt(held);

  if (h === 0) {
    return null;
  }

  return Math.floor((a * 1000) / h);
}

export function formatDisplayPercent(attended: number, held: number): string {
  const tenths = getPercentTenths(attended, held);
  if (tenths === null) {
    return 'No data';
  }

  const whole = Math.floor(tenths / 10);
  const tenth = tenths % 10;
  return tenth === 0 ? `${whole}%` : `${whole}.${tenth}%`;
}

export function formatPercentSpoken(attended: number, held: number): string {
  const tenths = getPercentTenths(attended, held);
  if (tenths === null) {
    return 'no data';
  }

  const whole = Math.floor(tenths / 10);
  const tenth = tenths % 10;
  return tenth === 0 ? `${whole} percent` : `${whole}.${tenth} percent`;
}

export function formatPointsChange(
  currentTenths: number | null,
  projectedTenths: number | null
): string | null {
  if (currentTenths === null || projectedTenths === null) {
    return null;
  }

  const diff = projectedTenths - currentTenths;
  if (diff === 0) {
    return '0 points';
  }

  const sign = diff > 0 ? '+' : '-';
  const abs = Math.abs(diff);
  const whole = Math.floor(abs / 10);
  const tenth = abs % 10;
  const formatted = tenth === 0 ? `${whole}` : `${whole}.${tenth}`;
  return `${sign}${formatted} points`;
}

export function getAttendanceRatio(
  attended: number,
  held: number
): number | null {
  const a = normalizeNonNegativeInt(attended);
  const h = normalizeNonNegativeInt(held);

  if (h === 0) {
    return null;
  }

  return (a * 100) / h;
}

export function getAttendanceLevel(
  attended: number,
  held: number,
  target: number
): AttendanceLevel {
  const h = normalizeNonNegativeInt(held);
  if (h === 0) {
    return 'no_data';
  }

  const t = clampTarget(target);
  if (!meetsTarget(attended, h, t)) {
    return 'below';
  }

  if (canSkip(attended, h, t) <= 1) {
    return 'borderline';
  }

  return 'safe';
}

export function levelToTone(level: AttendanceLevel): AttendanceTone {
  switch (level) {
    case 'safe':
      return 'safe';
    case 'borderline':
      return 'warn';
    case 'below':
      return 'danger';
    case 'no_data':
      return 'muted';
  }
}

export function pluralizeClasses(count: number): string {
  return count === 1 ? 'class' : 'classes';
}

export function getInsightText(
  attended: number,
  held: number,
  target: number
): string {
  const h = normalizeNonNegativeInt(held);
  const t = clampTarget(target);

  if (h === 0) {
    return 'No classes counted yet. Mark attendance to see your skip limit.';
  }

  if (!meetsTarget(attended, h, t)) {
    const needed = mustAttend(attended, h, t);
    return `Below ${t}%. Attend the next ${needed} ${pluralizeClasses(needed)} in a row to reach ${t}%.`;
  }

  const skipAllowance = canSkip(attended, h, t);
  if (skipAllowance === 0) {
    return `On target with no margin. Missing the next class puts you below ${t}%.`;
  }

  return `You can skip ${skipAllowance} more ${pluralizeClasses(skipAllowance)} and stay at or above ${t}%.`;
}
