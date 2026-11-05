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
