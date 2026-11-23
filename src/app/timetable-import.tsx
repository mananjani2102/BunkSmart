import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Segmented, type SegmentedOption } from '@/components/ui/Segmented';
import { useAuth } from '@/context/AuthProvider';
import { useData } from '@/context/DataProvider';
import { countAttendanceLogs } from '@/data/logs';
import { formatTime12Hour, LONG_WEEKDAYS } from '@/lib/dates';
import { AppError, getFriendlyErrorMessage } from '@/lib/errors';
import {
  parseTimetable,
  type ParsedTimetableEntry,
  type TimetableParseResult,
} from '@/lib/timetableParser';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const MODAL_EDGES = ['bottom', 'left', 'right'] as const;

type ImportMode = 'add' | 'replace';

const ALL_MODE_OPTIONS: readonly SegmentedOption<ImportMode>[] = [
  { label: 'Add to my timetable', value: 'add' },
  { label: 'Replace my timetable', value: 'replace' },
];

const ADD_ONLY_OPTIONS: readonly SegmentedOption<ImportMode>[] = [
  { label: 'Add to my timetable', value: 'add' },
];

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export default function TimetableImportScreen() {
  const { user } = useAuth();
  const { subjects, slots, importTimetable } = useData();

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

  const entries = useMemo(
    () => parseResult?.entries ?? [],
    [parseResult]
  );
  const problems = parseResult?.problems ?? [];
  const ignoredCount = parseResult?.ignoredCount ?? 0;

  // Group entries by weekday (1 = Monday to 7 = Sunday)
  const groupedEntries = useMemo(() => {
    const groups: { weekday: number; dayName: string; list: ParsedTimetableEntry[] }[] =
      [];
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

  // Distinct subjects in parsed entries
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

  // Actual number of classes that will be created
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

      await importTimetable(
        summary.uniqueSubjectNames,
        slotsPayload,
        mode === 'replace'
      );

      router.back();
      Alert.alert(
        'Timetable imported',
        `Added ${classesToCreateCount} ${
          classesToCreateCount === 1 ? 'class' : 'classes'
        }.`
      );
    } catch (err) {
      if (!(err instanceof AppError)) {
        console.error('Timetable import failed:', err);
      }
      setErrorMessage(getFriendlyErrorMessage(err));
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };

  const modeOptions = hasAttendanceLogs ? ADD_ONLY_OPTIONS : ALL_MODE_OPTIONS;

  return (
    <Screen edges={MODAL_EDGES} padded={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Multiline text input container */}
          <View style={styles.inputSection}>
            <AppText variant="label" style={styles.inputLabel}>
              Timetable text
            </AppText>
            <View style={styles.textInputWrapper}>
              <TextInput
                value={rawText}
                onChangeText={handleTextChange}
                placeholder="Paste or type your timetable"
                placeholderTextColor={colors.textMuted}
                multiline
                scrollEnabled={false}
                textAlignVertical="top"
                style={styles.textInput}
              />
            </View>
          </View>

          {/* Static Help Block: Format */}
          <Card style={styles.helpCard}>
            <View style={styles.helpHeaderRow}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={colors.accent}
              />
              <AppText variant="heading" style={styles.helpTitle}>
                Format
              </AppText>
            </View>

            <AppText variant="caption" tone="muted" style={styles.helpSubtitle}>
              Two supported formats:
            </AppText>

            <View style={styles.exampleBlock}>
              <AppText variant="caption" style={styles.exampleTitle}>
                1. Day header style:
              </AppText>
              <AppText variant="caption" tone="muted" style={styles.exampleCode}>
                {'Monday:\n9:00-10:00 Physics\n10:00-11:00 Maths'}
              </AppText>
            </View>

            <View style={styles.exampleBlock}>
              <AppText variant="caption" style={styles.exampleTitle}>
                2. Single-line style:
              </AppText>
              <AppText variant="caption" tone="muted" style={styles.exampleCode}>
                {'Mon 9:00-10:00 Physics\nTue 1:00-2:00 Chemistry'}
              </AppText>
            </View>

            <AppText variant="caption" style={styles.timeRuleNote}>
              Times without AM or PM: 7 to 11 are morning, 1 to 6 are afternoon.
            </AppText>
          </Card>

          {/* Action button to parse and preview */}
          <Button
            title="Check text"
            variant="secondary"
            icon="checkmark-circle-outline"
            onPress={handleCheckText}
            disabled={!rawText.trim() || saving}
            style={styles.checkButton}
          />

          {/* Global parser error (e.g. line limit exceeded) */}
          {parseResult?.error ? (
            <Card style={styles.errorCard}>
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={18} color={colors.danger} />
                <AppText variant="body" tone="danger" style={styles.errorText}>
                  {parseResult.error}
                </AppText>
              </View>
            </Card>
          ) : null}

          {/* Preview Section */}
          {parseResult && !parseResult.error ? (
            <View style={styles.previewContainer}>
              {/* Summary Line */}
              {summary && summary.totalClasses > 0 ? (
                <View style={styles.summaryBar}>
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={colors.accent}
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

              {/* Grouped classes by day */}
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
                        existingSlotSet.has(
                          `${entry.weekday}:${entry.startTime}`
                        );

                      const startTimeFormatted = formatTime12Hour(
                        entry.startTime
                      );
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
                            <AppText
                              variant="body"
                              style={styles.classSubject}
                            >
                              {entry.subjectName}
                            </AppText>
                            <AppText
                              variant="caption"
                              tone="muted"
                              style={styles.classTime}
                            >
                              {`${startTimeFormatted} - ${endTimeFormatted}`}
                            </AppText>
                          </View>

                          <View style={styles.badgeRow}>
                            {isNewSubject ? (
                              <View style={styles.newBadge}>
                                <AppText
                                  variant="caption"
                                  style={styles.newBadgeText}
                                >
                                  New subject
                                </AppText>
                              </View>
                            ) : null}

                            {entry.endTimeAssumed ? (
                              <View style={styles.assumedBadge}>
                                <AppText
                                  variant="caption"
                                  style={styles.assumedBadgeText}
                                >
                                  End time assumed
                                </AppText>
                              </View>
                            ) : null}

                            {isAlreadyInTimetable ? (
                              <View style={styles.skippedBadge}>
                                <AppText
                                  variant="caption"
                                  style={styles.skippedBadgeText}
                                >
                                  Already in timetable (skipped)
                                </AppText>
                              </View>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                  </Card>
                </View>
              ))}

              {/* Problem Lines Block */}
              {problems.length > 0 ? (
                <Card style={styles.problemCard}>
                  <View style={styles.problemHeaderRow}>
                    <Ionicons
                      name="warning-outline"
                      size={18}
                      color={colors.warn}
                    />
                    <AppText variant="heading" style={styles.problemTitle}>
                      {`Problem lines (${problems.length})`}
                    </AppText>
                  </View>

                  <AppText
                    variant="caption"
                    tone="muted"
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

              {/* Ignored Break Lines Note */}
              {ignoredCount > 0 ? (
                <View style={styles.ignoredNoteRow}>
                  <Ionicons
                    name="cafe-outline"
                    size={16}
                    color={colors.textMuted}
                  />
                  <AppText variant="caption" tone="muted">
                    {`Ignored ${ignoredCount} break ${
                      ignoredCount === 1 ? 'line' : 'lines'
                    }.`}
                  </AppText>
                </View>
              ) : null}

              {/* Mode Selector */}
              <View style={styles.modeSection}>
                <Segmented
                  options={modeOptions}
                  value={mode}
                  onChange={setMode}
                />
                {hasAttendanceLogs ? (
                  <AppText
                    variant="caption"
                    tone="muted"
                    style={styles.modeHelperText}
                  >
                    Replace is only available before you mark attendance.
                  </AppText>
                ) : null}
              </View>

              {/* Friendly Error Banner on failure */}
              {errorMessage ? (
                <Card style={styles.errorCard}>
                  <View style={styles.errorRow}>
                    <Ionicons
                      name="alert-circle"
                      size={18}
                      color={colors.danger}
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

              {/* Primary Action Button */}
              <Button
                title={`Add ${classesToCreateCount} ${
                  classesToCreateCount === 1 ? 'class' : 'classes'
                }`}
                variant="primary"
                onPress={() => {
                  void handleImport();
                }}
                disabled={classesToCreateCount === 0 || saving}
                loading={saving}
                fullWidth
                style={styles.importPrimaryBtn}
              />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl + 40,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  inputSection: {
    width: '100%',
  },
  inputLabel: {
    marginBottom: spacing.xs,
  },
  textInputWrapper: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    minHeight: 140,
    padding: spacing.md,
  },
  textInput: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  helpCard: {
    marginTop: spacing.md,
    padding: spacing.md,
  },
  helpHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  helpTitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  helpSubtitle: {
    marginBottom: spacing.sm,
  },
  exampleBlock: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.small,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  exampleTitle: {
    fontWeight: '600',
    marginBottom: 2,
  },
  exampleCode: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    lineHeight: 16,
  },
  timeRuleNote: {
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  checkButton: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
  },
  previewContainer: {
    marginTop: spacing.xl,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.control,
    marginBottom: spacing.md,
  },
  summaryText: {
    color: colors.accent,
    fontWeight: '600',
    flex: 1,
  },
  dayGroup: {
    marginBottom: spacing.md,
  },
  dayGroupTitle: {
    marginBottom: spacing.xs,
    fontWeight: '600',
    color: colors.text,
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
    fontWeight: '600',
  },
  classTime: {
    color: colors.textMuted,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  newBadge: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.small,
  },
  newBadgeText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '600',
  },
  assumedBadge: {
    backgroundColor: colors.warnBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.small,
  },
  assumedBadgeText: {
    color: colors.warn,
    fontSize: 11,
    fontWeight: '600',
  },
  skippedBadge: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.small,
  },
  skippedBadgeText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  problemCard: {
    marginTop: spacing.md,
    borderColor: colors.warn,
    borderWidth: 1,
  },
  problemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  problemTitle: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.warn,
  },
  problemNote: {
    marginBottom: spacing.sm,
  },
  problemList: {
    gap: spacing.sm,
  },
  problemItem: {
    backgroundColor: colors.surfaceMuted,
    padding: spacing.sm,
    borderRadius: radius.small,
  },
  problemItemHeader: {
    fontWeight: '600',
    color: colors.text,
  },
  problemItemText: {
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
  },
  ignoredNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  modeSection: {
    marginTop: spacing.lg,
  },
  modeHelperText: {
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  errorCard: {
    marginTop: spacing.md,
    backgroundColor: colors.dangerBg,
    borderColor: colors.danger,
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
  importPrimaryBtn: {
    marginTop: spacing.lg,
  },
});
