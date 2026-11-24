import { type AttendanceCounts, combineCounts } from './attendance';

export type OverallMode = 'college' | 'tracked';

export interface BaselineFields {
  baseline_attended: number;
  baseline_held: number;
  baseline_date: string | null;
}

export interface LogsAfterBaselineCounts {
  present: number;
  absent: number;
}

export interface OverallResult {
  attended: number;
  held: number;
  mode: OverallMode;
  asOfDate: string | null;
}

function normalizeNonNegativeInt(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
}

/**
 * Computes overall attendance counts and tracking mode from the user's
 * optional college baseline, per-subject stats, and logs strictly after the
 * baseline date.
 */
export function computeOverallAttendance(
  baseline: BaselineFields,
  subjectStats: readonly AttendanceCounts[],
  logsAfterBaseline: LogsAfterBaselineCounts
): OverallResult {
  const baselineHeld = normalizeNonNegativeInt(baseline.baseline_held);
  const baselineDate =
    typeof baseline.baseline_date === 'string' &&
    baseline.baseline_date.trim().length > 0
      ? baseline.baseline_date.trim()
      : null;

  if (baselineHeld > 0 && baselineDate !== null) {
    const baselineAttended = Math.min(
      baselineHeld,
      normalizeNonNegativeInt(baseline.baseline_attended)
    );
    const presentAfter = normalizeNonNegativeInt(logsAfterBaseline.present);
    const absentAfter = normalizeNonNegativeInt(logsAfterBaseline.absent);

    return {
      attended: baselineAttended + presentAfter,
      held: baselineHeld + presentAfter + absentAfter,
      mode: 'college',
      asOfDate: baselineDate,
    };
  }

  const combined = combineCounts(subjectStats);
  return {
    attended: combined.attended,
    held: combined.held,
    mode: 'tracked',
    asOfDate: null,
  };
}
