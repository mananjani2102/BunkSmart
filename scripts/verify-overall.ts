import { computeOverallAttendance } from '../src/lib/overall';

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `Assertion failed for ${label}: expected ${String(expected)}, received ${String(actual)}`
    );
  }
}

// 1. College mode: baseline 96/120 + 5 present and 1 absent after baseline date -> 101/126
const collegeResult = computeOverallAttendance(
  {
    baseline_attended: 96,
    baseline_held: 120,
    baseline_date: '2026-10-01',
  },
  [
    { attended: 18, held: 22 },
    { attended: 10, held: 12 },
  ],
  { present: 5, absent: 1 }
);
assertEqual(collegeResult.mode, 'college', 'college mode');
assertEqual(collegeResult.attended, 101, 'college attended');
assertEqual(collegeResult.held, 126, 'college held');
assertEqual(collegeResult.asOfDate, '2026-10-01', 'college asOfDate');

// 2. Tracked mode: no baseline, subject stats 18/22 and 10/12 -> 28/34
const trackedResult = computeOverallAttendance(
  {
    baseline_attended: 0,
    baseline_held: 0,
    baseline_date: null,
  },
  [
    { attended: 18, held: 22 },
    { attended: 10, held: 12 },
  ],
  { present: 3, absent: 2 }
);
assertEqual(trackedResult.mode, 'tracked', 'tracked mode');
assertEqual(trackedResult.attended, 28, 'tracked attended');
assertEqual(trackedResult.held, 34, 'tracked held');
assertEqual(trackedResult.asOfDate, null, 'tracked asOfDate');

// 3. Baseline held 0 is tracked mode even if baseline attended is 0 and date is set
const zeroHeldResult = computeOverallAttendance(
  {
    baseline_attended: 0,
    baseline_held: 0,
    baseline_date: '2026-10-01',
  },
  [{ attended: 4, held: 5 }],
  { present: 2, absent: 1 }
);
assertEqual(zeroHeldResult.mode, 'tracked', 'zero baseline_held mode');
assertEqual(zeroHeldResult.attended, 4, 'zero baseline_held attended');
assertEqual(zeroHeldResult.held, 5, 'zero baseline_held held');
assertEqual(zeroHeldResult.asOfDate, null, 'zero baseline_held asOfDate');

// 4. Baseline held above 0 but no baseline date is tracked mode
const missingDateResult = computeOverallAttendance(
  {
    baseline_attended: 50,
    baseline_held: 60,
    baseline_date: null,
  },
  [{ attended: 7, held: 10 }],
  { present: 4, absent: 0 }
);
assertEqual(missingDateResult.mode, 'tracked', 'missing baseline_date mode');
assertEqual(missingDateResult.attended, 7, 'missing baseline_date attended');
assertEqual(missingDateResult.held, 10, 'missing baseline_date held');
assertEqual(missingDateResult.asOfDate, null, 'missing baseline_date asOfDate');

process.stdout.write('all checks passed\n');
