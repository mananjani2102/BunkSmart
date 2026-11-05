import {
  canSkip,
  formatDisplayPercent,
  getAttendanceLevel,
  getAttendanceRatio,
  meetsTarget,
  mustAttend,
  projectAttendance,
} from '../src/lib/attendance';

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `Assertion failed for ${label}: expected ${String(expected)}, received ${String(actual)}`
    );
  }
}

// can skip cases
assertEqual(canSkip(18, 22, 75), 2, 'canSkip(18, 22, 75)');
assertEqual(canSkip(15, 22, 75), 0, 'canSkip(15, 22, 75)');
assertEqual(canSkip(3, 4, 75), 0, 'canSkip(3, 4, 75)');
assertEqual(canSkip(0, 0, 75), 0, 'canSkip(0, 0, 75)');
assertEqual(canSkip(17, 20, 80), 1, 'canSkip(17, 20, 80)');
assertEqual(canSkip(16, 20, 80), 0, 'canSkip(16, 20, 80)');
assertEqual(canSkip(19, 19, 95), 1, 'canSkip(19, 19, 95)');

// must attend cases
assertEqual(mustAttend(15, 22, 75), 6, 'mustAttend(15, 22, 75)');
assertEqual(mustAttend(18, 22, 75), 0, 'mustAttend(18, 22, 75)');
assertEqual(mustAttend(10, 20, 80), 30, 'mustAttend(10, 20, 80)');

// meets target cases
assertEqual(meetsTarget(3, 4, 75), true, 'meetsTarget(3, 4, 75)');

// display percent cases
assertEqual(formatDisplayPercent(18, 22), '81.8%', 'formatDisplayPercent(18, 22)');
assertEqual(formatDisplayPercent(3, 4), '75%', 'formatDisplayPercent(3, 4)');
assertEqual(formatDisplayPercent(749, 1000), '74.9%', 'formatDisplayPercent(749, 1000)');
assertEqual(formatDisplayPercent(0, 0), 'No data', 'formatDisplayPercent(0, 0)');

// ratio cases
assertEqual(getAttendanceRatio(0, 0), null, 'getAttendanceRatio(0, 0)');

// projection cases
const projected = projectAttendance(18, 22, 0, 4);
assertEqual(
  formatDisplayPercent(projected.attended, projected.held),
  '69.2%',
  'projection 18/22 +0/-4 display percent'
);
assertEqual(
  mustAttend(projected.attended, projected.held, 75),
  6,
  'projection 18/22 +0/-4 mustAttend at 75'
);

// level cases
assertEqual(getAttendanceLevel(15, 22, 75), 'below', 'level(15, 22, 75)');
assertEqual(getAttendanceLevel(18, 22, 75), 'safe', 'level(18, 22, 75)');
assertEqual(getAttendanceLevel(3, 4, 75), 'borderline', 'level(3, 4, 75)');
assertEqual(getAttendanceLevel(0, 0, 75), 'no_data', 'level(0, 0, 75)');

process.stdout.write('all checks passed\n');
