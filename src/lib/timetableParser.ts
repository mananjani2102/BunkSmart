export interface ParsedTimetableEntry {
  weekday: number;
  startTime: string;
  endTime: string;
  subjectName: string;
  endTimeAssumed: boolean;
}

export interface TimetableProblem {
  lineNumber: number;
  text: string;
  reason: string;
}

export interface TimetableParseResult {
  entries: ParsedTimetableEntry[];
  problems: TimetableProblem[];
  ignoredCount: number;
  error?: string;
}

const MAX_LINES = 200;
const MAX_CLASSES = 80;

const DAY_MAP: Record<string, number> = {
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
  sun: 7,
  sunday: 7,
};

const DAY_HEADER_REGEX =
  /^(Monday|Mon|Tuesday|Tues|Tue|Wednesday|Wed|Thursday|Thurs|Thur|Thu|Friday|Fri|Saturday|Sat|Sunday|Sun):?$/i;

const INLINE_DAY_PREFIX_REGEX =
  /^(Monday|Mon|Tuesday|Tues|Tue|Wednesday|Wed|Thursday|Thurs|Thur|Thu|Friday|Fri|Saturday|Sat|Sunday|Sun)(?::\s*|\s*-\s*|\s+)(.*)$/i;

const LIST_MARKER_REGEX = /^(?:\d+[.)]|[*\-+\u2022\u25AA\u25E6])\s+/;

const TIME_TOKEN_PATTERN = '(\\d{1,2})(?:[:.](\\d{2}))?\\s*(am|pm)?';
const SEPARATOR_PATTERN = '(?:\\s*[-\\u2013\\u2014]\\s*|\\s+to\\s+)';

const CLASS_LINE_REGEX = new RegExp(
  `^${TIME_TOKEN_PATTERN}(?:${SEPARATOR_PATTERN}${TIME_TOKEN_PATTERN})?(?:\\s*(.*))?$`,
  'i'
);

function padZero(value: number): string {
  return value.toString().padStart(2, '0');
}

interface ParsedTimeToken {
  hour: number;
  minute: number;
}

function parseTimeToken(
  hourStr: string,
  minStr: string | undefined,
  meridianStr: string | undefined
): ParsedTimeToken | null {
  const rawHour = parseInt(hourStr, 10);
  const minute = minStr !== undefined ? parseInt(minStr, 10) : 0;

  if (minute < 0 || minute > 59) {
    return null;
  }

  const meridian = meridianStr ? meridianStr.toLowerCase() : null;

  if (meridian) {
    if (rawHour < 1 || rawHour > 12) {
      return null;
    }
    let h = rawHour;
    if (meridian === 'am') {
      h = rawHour === 12 ? 0 : rawHour;
    } else if (meridian === 'pm') {
      h = rawHour === 12 ? 12 : rawHour + 12;
    }
    return { hour: h, minute };
  }

  // When a time has no AM or PM:
  // hours 7 to 11 are morning, hour 12 is noon, hours 1 to 6 are afternoon or evening (add 12 hours),
  // and hours 13 to 23 stay as they are.
  if (rawHour >= 7 && rawHour <= 11) {
    return { hour: rawHour, minute };
  }
  if (rawHour === 12) {
    return { hour: 12, minute };
  }
  if (rawHour >= 1 && rawHour <= 6) {
    return { hour: rawHour + 12, minute };
  }
  if (rawHour >= 13 && rawHour <= 23) {
    return { hour: rawHour, minute };
  }
  if (rawHour === 0) {
    return { hour: 0, minute };
  }

  return null;
}

function formatTimeString(token: ParsedTimeToken): string {
  return `${padZero(token.hour)}:${padZero(token.minute)}:00`;
}

function isBreakSubject(subject: string): boolean {
  const lower = subject.toLowerCase();
  return (
    lower === 'lunch' ||
    lower === 'break' ||
    lower === 'recess' ||
    lower === 'free period'
  );
}

export function parseTimetable(rawText: string): TimetableParseResult {
  const normalized = rawText.trimEnd();
  if (!normalized) {
    return { entries: [], problems: [], ignoredCount: 0 };
  }

  const rawLines = normalized.split(/\r?\n/);

  if (rawLines.length > MAX_LINES) {
    return {
      entries: [],
      problems: [
        {
          lineNumber: 1,
          text: '',
          reason: 'Text exceeds the 200 line limit.',
        },
      ],
      ignoredCount: 0,
      error: 'Pasted text exceeds the 200 line limit.',
    };
  }

  const entries: ParsedTimetableEntry[] = [];
  const problems: TimetableProblem[] = [];
  let ignoredCount = 0;
  let currentWeekday: number | null = null;
  let error: string | undefined;

  for (let i = 0; i < rawLines.length; i += 1) {
    const originalLine = rawLines[i];
    const lineNumber = i + 1;
    let line = originalLine.trim();

    if (line.length === 0) {
      continue;
    }

    // Strip optional leading list markers (e.g. "1.", "1)", bullet) followed by space
    line = line.replace(LIST_MARKER_REGEX, '').trim();

    // Check if line contains only a day name (optionally followed by colon)
    const headerMatch = line.match(DAY_HEADER_REGEX);
    if (headerMatch) {
      const dayKey = headerMatch[1].toLowerCase();
      currentWeekday = DAY_MAP[dayKey] ?? null;
      continue;
    }

    // Check if line starts with an inline day prefix
    let lineWeekday: number | null = null;
    let classContent = line;

    const inlineMatch = line.match(INLINE_DAY_PREFIX_REGEX);
    if (inlineMatch) {
      const dayKey = inlineMatch[1].toLowerCase();
      lineWeekday = DAY_MAP[dayKey] ?? null;
      classContent = inlineMatch[2].trim();
    } else {
      lineWeekday = currentWeekday;
    }

    // Attempt to match class pattern (start time, optional end time, subject)
    const classMatch = classContent.match(CLASS_LINE_REGEX);
    if (!classMatch) {
      problems.push({
        lineNumber,
        text: originalLine,
        reason:
          'Could not read this line. Use a format like: Mon 9:00-10:00 Physics.',
      });
      continue;
    }

    // If start time does not parse validly
    const startHourStr = classMatch[1];
    const startMinStr = classMatch[2];
    const startMeridian = classMatch[3];
    const startToken = parseTimeToken(startHourStr, startMinStr, startMeridian);

    if (!startToken) {
      problems.push({
        lineNumber,
        text: originalLine,
        reason:
          'Could not read this line. Use a format like: Mon 9:00-10:00 Physics.',
      });
      continue;
    }

    // Line has a valid time, check if weekday is set
    if (lineWeekday === null) {
      problems.push({
        lineNumber,
        text: originalLine,
        reason: 'Add a day before this class.',
      });
      continue;
    }

    const endHourStr = classMatch[4];
    const endMinStr = classMatch[5];
    const endMeridian = classMatch[6];
    const restStr = classMatch[7] ?? '';

    let endToken: ParsedTimeToken | null = null;
    let endTimeAssumed = false;

    if (endHourStr !== undefined) {
      endToken = parseTimeToken(endHourStr, endMinStr, endMeridian);
      if (!endToken) {
        problems.push({
          lineNumber,
          text: originalLine,
          reason:
            'Could not read this line. Use a format like: Mon 9:00-10:00 Physics.',
        });
        continue;
      }
    } else {
      // If there is no end time, set end to start plus 60 minutes and set the end assumed flag
      const totalStartMinutes = startToken.hour * 60 + startToken.minute;
      const totalEndMinutes = totalStartMinutes + 60;
      if (totalEndMinutes >= 24 * 60) {
        problems.push({
          lineNumber,
          text: originalLine,
          reason: 'End time must be after the start time.',
        });
        continue;
      }
      endToken = {
        hour: Math.floor(totalEndMinutes / 60),
        minute: totalEndMinutes % 60,
      };
      endTimeAssumed = true;
    }

    // Check that end time is later than start time
    const startMinutes = startToken.hour * 60 + startToken.minute;
    const endMinutes = endToken.hour * 60 + endToken.minute;
    if (endMinutes <= startMinutes) {
      problems.push({
        lineNumber,
        text: originalLine,
        reason: 'End time must be after the start time.',
      });
      continue;
    }

    // Clean subject name: trim, strip leading separators (colon, hyphen, closing bracket), collapse spaces
    let subject = restStr.trim();
    subject = subject.replace(/^[:\-)\s]+/, '').trim();
    subject = subject.replace(/\s+/g, ' ');

    if (subject.length < 1 || subject.length > 60) {
      problems.push({
        lineNumber,
        text: originalLine,
        reason:
          'Could not read this line. Use a format like: Mon 9:00-10:00 Physics.',
      });
      continue;
    }

    // Ignore break lines
    if (isBreakSubject(subject)) {
      ignoredCount += 1;
      continue;
    }

    const startTimeFormatted = formatTimeString(startToken);
    const endTimeFormatted = formatTimeString(endToken);

    // Duplicate check: two entries with the same day and start time
    const isDuplicate = entries.some(
      (e) =>
        e.weekday === lineWeekday && e.startTime === startTimeFormatted
    );

    if (isDuplicate) {
      problems.push({
        lineNumber,
        text: originalLine,
        reason: `Duplicate class at ${startTimeFormatted.slice(0, 5)}.`,
      });
      continue;
    }

    if (entries.length >= MAX_CLASSES) {
      error = 'Cannot import more than 80 classes.';
      problems.push({
        lineNumber,
        text: originalLine,
        reason: 'Cannot import more than 80 classes.',
      });
      continue;
    }

    entries.push({
      weekday: lineWeekday,
      startTime: startTimeFormatted,
      endTime: endTimeFormatted,
      subjectName: subject,
      endTimeAssumed,
    });
  }

  return {
    entries,
    problems,
    ignoredCount,
    error,
  };
}
