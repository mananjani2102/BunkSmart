import { parseTimetable } from '../src/lib/timetableParser';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `Assertion failed for ${label}: expected ${String(expected)}, received ${String(actual)}`
    );
  }
}

// 1. Monday header followed by 9:00-10:00 Physics and 10:00-11:00 Maths
const res1 = parseTimetable('Monday\n9:00-10:00 Physics\n10:00-11:00 Maths');
assertEqual(res1.entries.length, 2, 'res1 entries length');
assertEqual(res1.entries[0].weekday, 1, 'res1[0] weekday');
assertEqual(res1.entries[0].startTime, '09:00:00', 'res1[0] startTime');
assertEqual(res1.entries[0].endTime, '10:00:00', 'res1[0] endTime');
assertEqual(res1.entries[0].subjectName, 'Physics', 'res1[0] subject');
assertEqual(res1.entries[0].endTimeAssumed, false, 'res1[0] endTimeAssumed');
assertEqual(res1.entries[1].weekday, 1, 'res1[1] weekday');
assertEqual(res1.entries[1].startTime, '10:00:00', 'res1[1] startTime');
assertEqual(res1.entries[1].endTime, '11:00:00', 'res1[1] endTime');
assertEqual(res1.entries[1].subjectName, 'Maths', 'res1[1] subject');
assertEqual(res1.entries[1].endTimeAssumed, false, 'res1[1] endTimeAssumed');

// 2. "Tue 1-2 Chemistry" gives Tuesday 13:00 to 14:00
const res2 = parseTimetable('Tue 1-2 Chemistry');
assertEqual(res2.entries.length, 1, 'res2 entries length');
assertEqual(res2.entries[0].weekday, 2, 'res2 weekday');
assertEqual(res2.entries[0].startTime, '13:00:00', 'res2 startTime');
assertEqual(res2.entries[0].endTime, '14:00:00', 'res2 endTime');
assertEqual(res2.entries[0].subjectName, 'Chemistry', 'res2 subject');

// 3. "Wed 9am to 10am English" gives Wednesday 09:00 to 10:00
const res3 = parseTimetable('Wed 9am to 10am English');
assertEqual(res3.entries.length, 1, 'res3 entries length');
assertEqual(res3.entries[0].weekday, 3, 'res3 weekday');
assertEqual(res3.entries[0].startTime, '09:00:00', 'res3 startTime');
assertEqual(res3.entries[0].endTime, '10:00:00', 'res3 endTime');
assertEqual(res3.entries[0].subjectName, 'English', 'res3 subject');

// 4. "Thu: 8:30 - 9:30 Lab" gives Thursday 08:30 to 09:30
const res4 = parseTimetable('Thu: 8:30 - 9:30 Lab');
assertEqual(res4.entries.length, 1, 'res4 entries length');
assertEqual(res4.entries[0].weekday, 4, 'res4 weekday');
assertEqual(res4.entries[0].startTime, '08:30:00', 'res4 startTime');
assertEqual(res4.entries[0].endTime, '09:30:00', 'res4 endTime');
assertEqual(res4.entries[0].subjectName, 'Lab', 'res4 subject');

// 5. "Fri 11:00 Maths" gives Friday 11:00 to 12:00 with the end-assumed flag set
const res5 = parseTimetable('Fri 11:00 Maths');
assertEqual(res5.entries.length, 1, 'res5 entries length');
assertEqual(res5.entries[0].weekday, 5, 'res5 weekday');
assertEqual(res5.entries[0].startTime, '11:00:00', 'res5 startTime');
assertEqual(res5.entries[0].endTime, '12:00:00', 'res5 endTime');
assertEqual(res5.entries[0].subjectName, 'Maths', 'res5 subject');
assertEqual(res5.entries[0].endTimeAssumed, true, 'res5 endTimeAssumed');

// 6. "Mon 9.30-10.30 Chemistry" gives Monday 09:30 to 10:30
const res6 = parseTimetable('Mon 9.30-10.30 Chemistry');
assertEqual(res6.entries.length, 1, 'res6 entries length');
assertEqual(res6.entries[0].weekday, 1, 'res6 weekday');
assertEqual(res6.entries[0].startTime, '09:30:00', 'res6 startTime');
assertEqual(res6.entries[0].endTime, '10:30:00', 'res6 endTime');
assertEqual(res6.entries[0].subjectName, 'Chemistry', 'res6 subject');

// 7. A line using an en dash between the times and another using an em dash both parse correctly
const res7a = parseTimetable('Mon 9:00\u201310:00 Physics');
assertEqual(res7a.entries.length, 1, 'res7a entries length');
assertEqual(res7a.entries[0].startTime, '09:00:00', 'res7a startTime');
assertEqual(res7a.entries[0].endTime, '10:00:00', 'res7a endTime');

const res7b = parseTimetable('Mon 10:00\u201411:00 Maths');
assertEqual(res7b.entries.length, 1, 'res7b entries length');
assertEqual(res7b.entries[0].startTime, '10:00:00', 'res7b startTime');
assertEqual(res7b.entries[0].endTime, '11:00:00', 'res7b endTime');

// 8. "Fri 1-2 Lunch" is ignored and counted as ignored
const res8 = parseTimetable('Fri 1-2 Lunch');
assertEqual(res8.entries.length, 0, 'res8 entries length');
assertEqual(res8.ignoredCount, 1, 'res8 ignoredCount');
assertEqual(res8.problems.length, 0, 'res8 problems length');

// 9. "hello world" with a current day set is a problem line with the right line number
const res9 = parseTimetable('Monday\nhello world');
assertEqual(res9.problems.length, 1, 'res9 problems length');
assertEqual(res9.problems[0].lineNumber, 2, 'res9 lineNumber');
assertEqual(res9.problems[0].text, 'hello world', 'res9 problem text');
assertEqual(
  res9.problems[0].reason,
  'Could not read this line. Use a format like: Mon 9:00-10:00 Physics.',
  'res9 problem reason'
);

// 10. "Mon 10-9 Physics" is a problem line about the end time
const res10 = parseTimetable('Mon 10-9 Physics');
assertEqual(res10.problems.length, 1, 'res10 problems length');
assertEqual(
  res10.problems[0].reason,
  'End time must be after the start time.',
  'res10 problem reason'
);

// 11. Two entries "Mon 9-10 Physics" and "Mon 9-10 Maths" give one entry and one duplicate problem
const res11 = parseTimetable('Mon 9-10 Physics\nMon 9-10 Maths');
assertEqual(res11.entries.length, 1, 'res11 entries length');
assertEqual(res11.entries[0].subjectName, 'Physics', 'res11 kept entry');
assertEqual(res11.problems.length, 1, 'res11 problems length');
assertEqual(res11.problems[0].text, 'Mon 9-10 Maths', 'res11 problem text');
assert(
  res11.problems[0].reason.toLowerCase().includes('duplicate'),
  'res11 problem reason contains duplicate'
);

// 12. A class line before any day is set is a problem line
const res12 = parseTimetable('9-10 Physics');
assertEqual(res12.problems.length, 1, 'res12 problems length');
assertEqual(
  res12.problems[0].reason,
  'Add a day before this class.',
  'res12 problem reason'
);

// 13. "1. 9-10 Physics" under a Monday header parses as Physics 09:00 to 10:00
const res13 = parseTimetable('Monday\n1. 9-10 Physics');
assertEqual(res13.entries.length, 1, 'res13 entries length');
assertEqual(res13.entries[0].weekday, 1, 'res13 weekday');
assertEqual(res13.entries[0].startTime, '09:00:00', 'res13 startTime');
assertEqual(res13.entries[0].endTime, '10:00:00', 'res13 endTime');
assertEqual(res13.entries[0].subjectName, 'Physics', 'res13 subject');

// 14. "Maths-2" as a subject name keeps its hyphen
const res14 = parseTimetable('Mon 9-10 Maths-2');
assertEqual(res14.entries.length, 1, 'res14 entries length');
assertEqual(res14.entries[0].subjectName, 'Maths-2', 'res14 subject');

process.stdout.write('all checks passed\n');
