import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ModalFormLayout } from '@/components/ui/ModalFormLayout';
import { Segmented, type SegmentedOption } from '@/components/ui/Segmented';
import { useAuthState } from '@/context/AuthProvider';
import { useDataActions, useDataState } from '@/context/DataProvider';
import { useSnackbarActions } from '@/context/SnackbarProvider';
import { countAttendanceLogs } from '@/data/logs';
import { formatTime12Hour, LONG_WEEKDAYS } from '@/lib/dates';
import { getFriendlyErrorMessage } from '@/lib/errors';
import {
  parseTimetable,
  type ParsedTimetableEntry,
  type TimetableParseResult,
} from '@/lib/timetableParser';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import {
  fontFamily,
  radius,
  spacing,
  typography,
  type ThemeColors,
} from '@/theme/tokens';

type ImportMode = 'add' | 'replace';

const ALL_MODE_OPTIONS: readonly SegmentedOption<ImportMode>[] = [
  { label: 'Add to my timetable', value: 'add' },
  { label: 'Replace my timetable', value: 'replace' },
];

const ADD_ONLY_OPTIONS: readonly SegmentedOption<ImportMode>[] = [
  { label: 'Add to my timetable', value: 'add' },
];

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  inputSection: {
    width: '100%',
  },
  inputLabel: {
    marginBottom: spacing.xs,
  },
  textInputWrapper: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.input,
    borderRadius: radius.control,
    minHeight: 140,
    padding: spacing.md,
  },
  textInput: {
    color: colors.foreground,
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  helpCard: {
    padding: spacing.md,
  },
  helpHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  helpSubtitle: {
    marginBottom: spacing.sm,
  },
  exampleBlock: {
    backgroundColor: colors.muted,
    borderRadius: radius.small,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  exampleTitle: {
    fontFamily: fontFamily.medium,
    marginBottom: 2,
  },
  exampleCode: {
    fontVariant: ['tabular-nums'],
  },
  timeRuleNote: {
    marginTop: spacing.xs,
  },
  previewContainer: {
    gap: spacing.lg,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.control,
  },
  summaryText: {
    fontFamily: fontFamily.medium,
    flex: 1,
  },
  dayGroup: {
    gap: spacing.xs,
  },
  dayGroupTitle: {
    fontFamily: fontFamily.semibold,
  },
  dayCard: {
    paddingVertical: 0,
    paddingHorizontal: spacing.md,
  },
  classRow: {
    paddingVertical: spacing.sm,
  },
  classRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  classInfoCol: {
    gap: 2,
  },
  classSubject: {
    fontFamily: fontFamily.semibold,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  problemCard: {
    backgroundColor: colors.warningBg,
    borderColor: colors.amber,
    borderWidth: 1,
  },
  problemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  problemNote: {
    marginBottom: spacing.sm,
  },
  problemList: {
    gap: spacing.sm,
  },
  problemItem: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    borderRadius: radius.small,
  },
  problemItemHeader: {
    fontFamily: fontFamily.medium,
  },
  problemItemText: {
    marginTop: 2,
  },
  ignoredNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  modeSection: {
    gap: spacing.xs,
  },
  errorCard: {
    backgroundColor: colors.destructiveBg,
    borderColor: colors.destructive,
    borderWidth: 1,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorText: {
    flex: 1,
  },
}));

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export default function TimetableImportScreen() {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);

  const { user } = useAuthState();
  const { subjects, slots } = useDataState();
  const { importTimetable } = useDataActions();
  const { showSnackbar } = useSnackbarActions();

  const [rawText, setRawText] = useState('');
  const [parseResult, setParseResult] = useState<TimetableParseResult | null>(
    null
  );
  const [mode, setMode] = useState<ImportMode>('add');
  const [hasAttendanceLogs, setHasAttendanceLogs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const busyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function checkLogs() {
      if (!user?.id) return;
      try {
        const count = await countAttendanceLogs(user.id);
        if (!cancelled) {
          setHasAttendanceLogs(count > 0);
        }
      } catch {
        // Keep default false on check error
      }
    }
    void checkLogs();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const existingSubjectMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of subjects) {
      map.set(normalizeName(s.name), s.name);
    }
    return map;
  }, [subjects]);

  const existingSlotSet = useMemo(() => {
    const set = new Set<string>();
    for (const s of slots) {
      set.add(`${s.weekday}:${s.start_time}`);
    }
    return set;
  }, [slots]);

  const handleTextChange = (text: string) => {
    setRawText(text);
    if (parseResult) {
      setParseResult(null);
    }
    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  const handleCheckText = () => {
    setErrorMessage(null);
    const result = parseTimetable(rawText);
    setParseResult(result);
  };

  const entries = useMemo(() => parseResult?.entries ?? [], [parseResult]);
  const problems = parseResult?.problems ?? [];
  const ignoredCount = parseResult?.ignoredCount ?? 0;

  const groupedEntries = useMemo(() => {
    const groups: {
      weekday: number;
      dayName: string;
      list: ParsedTimetableEntry[];
    }[] = [];
    for (let day = 1; day <= 7; day += 1) {
      const list = entries.filter((e) => e.weekday === day);
      if (list.length > 0) {
        groups.push({
          weekday: day,
          dayName: LONG_WEEKDAYS[day - 1],
          list,
        });
      }
    }
    return groups;
  }, [entries]);

  const summary = useMemo(() => {
    if (!parseResult) return null;
    const totalClasses = entries.length;
    const uniqueSubjectMap = new Map<string, string>();
    for (const e of entries) {
      const key = normalizeName(e.subjectName);
      if (!uniqueSubjectMap.has(key)) {
        uniqueSubjectMap.set(key, e.subjectName.trim().replace(/\s+/g, ' '));
      }
    }
    const totalSubjects = uniqueSubjectMap.size;
    let newSubjectsCount = 0;
    for (const key of uniqueSubjectMap.keys()) {
      if (!existingSubjectMap.has(key)) {
        newSubjectsCount += 1;
      }
    }
    return {
      totalClasses,
      totalSubjects,
      newSubjectsCount,
      uniqueSubjectNames: Array.from(uniqueSubjectMap.values()),
    };
  }, [entries, existingSubjectMap, parseResult]);

  const classesToCreateCount = useMemo(() => {
    if (mode === 'replace') {
      return entries.length;
    }
    return entries.filter(
      (e) => !existingSlotSet.has(`${e.weekday}:${e.startTime}`)
    ).length;
  }, [entries, existingSlotSet, mode]);

  const handleImport = async () => {
    if (busyRef.current || classesToCreateCount === 0 || !summary) {
      return;
    }

    busyRef.current = true;
    setSaving(true);
    setErrorMessage(null);

    try {
      const slotsPayload = entries.map((e) => ({
        subjectName: e.subjectName,
        weekday: e.weekday,
        startTime: e.startTime,
        endTime: e.endTime,
      }));

      const result = await importTimetable(
        summary.uniqueSubjectNames,
        slotsPayload,
        mode === 'replace'
      );

      showSnackbar(
        `Added ${result.createdSlotsCount} ${
          result.createdSlotsCount === 1 ? 'class' : 'classes'
        } to timetable.`
      );
      router.back();
    } catch (err) {
      const message = getFriendlyErrorMessage(err);
      setErrorMessage(message);
      showSnackbar({ message, tone: 'error' });
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };

  const modeOptions = hasAttendanceLogs ? ADD_ONLY_OPTIONS : ALL_MODE_OPTIONS;

  const footer =
    parseResult && !parseResult.error && classesToCreateCount > 0 ? (
      <Button
        title={`Add ${classesToCreateCount} ${
          classesToCreateCount === 1 ? 'class' : 'classes'
        }`}
        variant="primary"
        onPress={() => {
          void handleImport();
        }}
        disabled={saving}
        loading={saving}
        fullWidth
      />
    ) : (
      <Button
        title="Check text"
        variant="primary"
        onPress={handleCheckText}
        disabled={!rawText.trim() || saving}
        fullWidth
      />
    );

  return (
    <ModalFormLayout footer={footer}>
      <View style={styles.inputSection}>
        <AppText variant="label" style={styles.inputLabel}>
          Timetable text
        </AppText>
        <View style={styles.textInputWrapper}>
          <TextInput
            value={rawText}
            onChangeText={handleTextChange}
            placeholder="Paste or type your timetable"
            placeholderTextColor={colors.mutedForeground}
            selectionColor={colors.foreground}
            multiline
            scrollEnabled={false}
            textAlignVertical="top"
            style={styles.textInput}
          />
        </View>
      </View>

      <Card style={styles.helpCard}>
        <View style={styles.helpHeaderRow}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={colors.foreground}
          />
          <AppText variant="heading">Format</AppText>
        </View>

        <AppText variant="caption" tone="muted" style={styles.helpSubtitle}>
          Two supported formats:
        </AppText>

        <View style={styles.exampleBlock}>
          <AppText variant="caption" tone="default" style={styles.exampleTitle}>
            1. Day header style:
          </AppText>
          <AppText variant="caption" tone="muted" style={styles.exampleCode}>
            {'Monday:\n9:00-10:00 Physics\n10:00-11:00 Maths'}
          </AppText>
        </View>

        <View style={styles.exampleBlock}>
          <AppText variant="caption" tone="default" style={styles.exampleTitle}>
            2. Single-line style:
          </AppText>
          <AppText variant="caption" tone="muted" style={styles.exampleCode}>
            {'Mon 9:00-10:00 Physics\nTue 1:00-2:00 Chemistry'}
          </AppText>
        </View>

        <AppText variant="caption" tone="muted" style={styles.timeRuleNote}>
          Times without AM or PM: 7 to 11 are morning, 1 to 6 are afternoon.
        </AppText>
      </Card>

      {parseResult?.error ? (
        <Card style={styles.errorCard}>
          <View style={styles.errorRow}>
            <Ionicons
              name="alert-circle"
              size={18}
              color={colors.destructiveText}
            />
            <AppText variant="body" tone="danger" style={styles.errorText}>
              {parseResult.error}
            </AppText>
          </View>
        </Card>
      ) : null}

      {parseResult && !parseResult.error ? (
        <View style={styles.previewContainer}>
          {summary && summary.totalClasses > 0 ? (
            <View style={styles.summaryBar}>
              <Ionicons
                name="calendar-outline"
                size={16}
                color={colors.foreground}
              />
              <AppText variant="label" style={styles.summaryText}>
                {`Found ${summary.totalClasses} ${
                  summary.totalClasses === 1 ? 'class' : 'classes'
                } in ${summary.totalSubjects} ${
                  summary.totalSubjects === 1 ? 'subject' : 'subjects'
                }. ${
                  summary.newSubjectsCount > 0
                    ? `${summary.newSubjectsCount} ${
                        summary.newSubjectsCount === 1
                          ? 'subject is'
                          : 'subjects are'
                      } new.`
                    : 'No new subjects.'
                }`}
              </AppText>
            </View>
          ) : null}

          {groupedEntries.map((group) => (
            <View key={`day-group-${group.weekday}`} style={styles.dayGroup}>
              <AppText variant="label" style={styles.dayGroupTitle}>
                {group.dayName}
              </AppText>

              <Card style={styles.dayCard}>
                {group.list.map((entry, idx) => {
                  const isNewSubject = !existingSubjectMap.has(
                    normalizeName(entry.subjectName)
                  );
                  const isAlreadyInTimetable =
                    mode === 'add' &&
                    existingSlotSet.has(`${entry.weekday}:${entry.startTime}`);

                  const startTimeFormatted = formatTime12Hour(entry.startTime);
                  const endTimeFormatted = formatTime12Hour(entry.endTime);

                  return (
                    <View
                      key={`entry-${entry.weekday}-${entry.startTime}-${idx}`}
                      style={[
                        styles.classRow,
                        idx > 0 && styles.classRowBorder,
                      ]}
                    >
                      <View style={styles.classInfoCol}>
                        <AppText variant="body" style={styles.classSubject}>
                          {entry.subjectName}
                        </AppText>
                        <AppText variant="caption" tone="muted">
                          {`${startTimeFormatted} - ${endTimeFormatted}`}
                        </AppText>
                      </View>

                      <View style={styles.badgeRow}>
                        {isNewSubject ? (
                          <Badge label="New subject" tone="info" />
                        ) : null}

                        {entry.endTimeAssumed ? (
                          <Badge label="End time assumed" tone="warning" />
                        ) : null}

                        {isAlreadyInTimetable ? (
                          <Badge
                            label="Already in timetable (skipped)"
                            tone="neutral"
                          />
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </Card>
            </View>
          ))}

          {problems.length > 0 ? (
            <Card style={styles.problemCard}>
              <View style={styles.problemHeaderRow}>
                <Ionicons
                  name="warning-outline"
                  size={18}
                  color={colors.warningText}
                />
                <AppText variant="heading" tone="warning">
                  {`Problem lines (${problems.length})`}
                </AppText>
              </View>

              <AppText
                variant="caption"
                tone="warning"
                style={styles.problemNote}
              >
                Fix the text and tap Check text again to include these lines.
              </AppText>

              <View style={styles.problemList}>
                {problems.map((p, pIdx) => (
                  <View
                    key={`prob-${p.lineNumber}-${pIdx}`}
                    style={styles.problemItem}
                  >
                    <AppText
                      variant="caption"
                      tone="default"
                      style={styles.problemItemHeader}
                    >
                      {`Line ${p.lineNumber}: ${p.reason}`}
                    </AppText>
                    {p.text ? (
                      <AppText
                        variant="caption"
                        tone="muted"
                        style={styles.problemItemText}
                      >
                        {p.text}
                      </AppText>
                    ) : null}
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          {ignoredCount > 0 ? (
            <View style={styles.ignoredNoteRow}>
              <Ionicons
                name="cafe-outline"
                size={16}
                color={colors.mutedForeground}
              />
              <AppText variant="caption" tone="muted">
                {`Ignored ${ignoredCount} break ${
                  ignoredCount === 1 ? 'line' : 'lines'
                }.`}
              </AppText>
            </View>
          ) : null}

          <View style={styles.modeSection}>
            <Segmented
              options={modeOptions}
              value={mode}
              onChange={setMode}
            />
            {hasAttendanceLogs ? (
              <AppText variant="caption" tone="muted">
                Replace is only available before you mark attendance.
              </AppText>
            ) : null}
          </View>

          {errorMessage ? (
            <Card style={styles.errorCard}>
              <View style={styles.errorRow}>
                <Ionicons
                  name="alert-circle"
                  size={18}
                  color={colors.destructiveText}
                />
                <AppText
                  variant="body"
                  tone="danger"
                  style={styles.errorText}
                >
                  {errorMessage}
                </AppText>
              </View>
            </Card>
          ) : null}
        </View>
      ) : null}
    </ModalFormLayout>
  );
}
