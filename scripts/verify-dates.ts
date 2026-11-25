import {
  countWeekdayOccurrences,
  formatDateDDMMYYYY,
  parseTypedDate,
} from '../src/lib/dates';

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `Assertion failed for ${label}: expected ${String(expected)}, received ${String(actual)}`
    );
  }
}

// 1. Typed date parsing
assertEqual(parseTypedDate('05/09/2026'), '2026-09-05', '05/09/2026');
assertEqual(parseTypedDate('5-9-2026'), '2026-09-05', '5-9-2026');
assertEqual(parseTypedDate('05.09.2026'), '2026-09-05', '05.09.2026');
assertEqual(parseTypedDate('31/02/2026'), null, '31/02/2026');
assertEqual(parseTypedDate('2026-09-05'), null, '2026-09-05');
assertEqual(parseTypedDate('05/09/26'), null, '05/09/26');

// 2. Formatting YYYY-MM-DD as DD/MM/YYYY
assertEqual(
  formatDateDDMMYYYY('2026-09-05'),
  '05/09/2026',
  'formatDateDDMMYYYY(2026-09-05)'
);

// 3. Weekday counts from 2026-11-02 (Monday) to 2026-11-16 inclusive
assertEqual(
  countWeekdayOccurrences('2026-11-02', '2026-11-16', 1),
  3,
  'Mondays in 2026-11-02..2026-11-16'
);
assertEqual(
  countWeekdayOccurrences('2026-11-02', '2026-11-16', 2),
  2,
  'Tuesdays in 2026-11-02..2026-11-16'
);

// 4. Full week 2026-11-02 to 2026-11-08: every weekday occurs once
for (let weekday = 1; weekday <= 7; weekday += 1) {
  assertEqual(
    countWeekdayOccurrences('2026-11-02', '2026-11-08', weekday),
    1,
    `weekday ${weekday} in 2026-11-02..2026-11-08`
  );
}

// 5. Start after end gives 0
assertEqual(
  countWeekdayOccurrences('2026-11-10', '2026-11-02', 1),
  0,
  'start after end'
);

process.stdout.write('all checks passed\n');
