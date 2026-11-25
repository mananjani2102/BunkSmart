import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DATE_FORMAT_ERROR, DateField } from '@/components/ui/DateField';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { useData } from '@/context/DataProvider';
import { fetchEarliestLogDate } from '@/data/logs';
import { updateSubject as updateSubjectRecord } from '@/data/subjects';
import { formatDisplayPercent } from '@/lib/attendance';
import {
  addDays,
  countWeekdayOccurrences,
  formatDateDDMMYYYY,
  getTodayDateString,
  parseTypedDate,
} from '@/lib/dates';
import { AppError, getFriendlyErrorMessage } from '@/lib/errors';
import { colors, radius, spacing } from '@/theme/tokens';
import { type Subject, type TimetableSlot } from '@/types/db';

interface EstimateSubjectEntry {
  heldText: string;
  missedText: string;
}

export interface PastAttendanceEstimateProps {
  subjects: readonly Subject[];
  slots: readonly TimetableSlot[];
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
}

function parseWholeNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value < 0) {
    return null;
  }
  return value;
}

function computeEstimatedHeldMap(
  subjects: readonly Subject[],
  slots: readonly TimetableSlot[],
  startDate: string,
  endDate: string
): Record<string, EstimateSubjectEntry> {
  const next: Record<string, EstimateSubjectEntry> = {};

  for (const subject of subjects) {
    let totalOccurrences = 0;
    for (const slot of slots) {
      if (slot.subject_id === subject.id) {
        totalOccurrences += countWeekdayOccurrences(
          startDate,
          endDate,
          slot.weekday
        );
      }
    }
    next[subject.id] = {
      heldText: String(totalOccurrences),
      missedText: '0',
    };
  }

  return next;
}

export function PastAttendanceEstimate({
  subjects,
  slots,
  busy,
  onBusyChange,
}: PastAttendanceEstimateProps) {
  const { reload } = useData();

  const [earliestLoading, setEarliestLoading] = useState(true);
  const [earliestLogDate, setEarliestLogDate] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [startDateText, setStartDateText] = useState('');
  const [entriesBySubject, setEntriesBySubject] = useState<
    Record<string, EstimateSubjectEntry>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const mountedRef = useRef(true);
  const savingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const loadEarliest = async () => {
      try {
        const earliest = await fetchEarliestLogDate();
        if (!cancelled && mountedRef.current) {
          setEarliestLogDate(earliest);
          setLoadError(null);
        }
      } catch (err) {
        if (!cancelled && mountedRef.current) {
          if (!(err instanceof AppError)) {
            console.error('Fetch earliest log date failed:', err);
          }
          setLoadError(getFriendlyErrorMessage(err));
        }
      } finally {
        if (!cancelled && mountedRef.current) {
          setEarliestLoading(false);
        }
      }
    };

    void loadEarliest();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, []);

  const yesterday = addDays(getTodayDateString(), -1);
  const endDate = earliestLogDate
    ? addDays(earliestLogDate, -1)
    : yesterday;
  const endDateDisplay = formatDateDDMMYYYY(endDate);

  const parsedStartDate = parseTypedDate(startDateText);
  const startDateRangeError =
    parsedStartDate !== null && parsedStartDate >= endDate
      ? `Start date must be before ${endDateDisplay}.`
      : undefined;

  const hasValidRange =
    parsedStartDate !== null && parsedStartDate < endDate;

  const handleStartDateChange = (nextText: string) => {
    setStartDateText(nextText);
    if (formError) {
      setFormError(null);
    }

    const parsed = parseTypedDate(nextText);
    if (parsed !== null && parsed < endDate) {
      setEntriesBySubject(
        computeEstimatedHeldMap(subjects, slots, parsed, endDate)
      );
    }
  };

  const updateEntry = (
    subjectId: string,
    patch: Partial<EstimateSubjectEntry>
  ) => {
    if (formError) {
      setFormError(null);
    }
    setEntriesBySubject((prev) => {
      const current = prev[subjectId] ?? { heldText: '0', missedText: '0' };
      return {
        ...prev,
        [subjectId]: {
          ...current,
          ...patch,
        },
      };
    });
  };

  const overallSummary = useMemo(() => {
    let totalAttended = 0;
    let totalHeld = 0;

    for (const subject of subjects) {
      const entry = entriesBySubject[subject.id];
      const held = entry ? parseWholeNumber(entry.heldText) : 0;
      const missed = entry ? parseWholeNumber(entry.missedText) : 0;
      if (held !== null && missed !== null && missed <= held) {
        totalAttended += held - missed;
        totalHeld += held;
      }
    }

    return {
      attended: totalAttended,
      held: totalHeld,
      percent: formatDisplayPercent(totalAttended, totalHeld),
    };
  }, [subjects, entriesBySubject]);

  const performSave = async () => {
    if (savingRef.current || busy) {
      return;
    }

    const parsedUpdates: { id: string; attended: number; held: number }[] = [];
    for (const subject of subjects) {
      const entry = entriesBySubject[subject.id] ?? {
        heldText: '0',
        missedText: '0',
      };
      const held = parseWholeNumber(entry.heldText);
      const missed = parseWholeNumber(entry.missedText);

      if (held === null || missed === null) {
        setFormError(
          `Enter whole numbers for ${subject.name}.`
        );
        return;
      }
      if (missed > held) {
        setFormError(
          `Missed classes cannot be more than held classes for ${subject.name}.`
        );
        return;
      }

      parsedUpdates.push({
        id: subject.id,
        attended: held - missed,
        held,
      });
    }

    savingRef.current = true;
    setSaving(true);
    onBusyChange(true);
    setFormError(null);

    try {
      await Promise.all(
        parsedUpdates.map((item) =>
          updateSubjectRecord(item.id, {
            initial_present: item.attended,
            initial_total: item.held,
          })
        )
      );
      await reload(true);
      router.back();
    } catch (err) {
      if (!(err instanceof AppError)) {
        console.error('Save estimated past attendance failed:', err);
      }
      if (mountedRef.current) {
        setFormError(getFriendlyErrorMessage(err));
      }
    } finally {
      savingRef.current = false;
      if (mountedRef.current) {
        setSaving(false);
        onBusyChange(false);
      }
    }
  };

  const handlePressSave = () => {
    if (savingRef.current || busy) {
      return;
    }

    if (parsedStartDate === null) {
      setFormError(DATE_FORMAT_ERROR);
      return;
    }
    if (parsedStartDate >= endDate) {
      setFormError(`Start date must be before ${endDateDisplay}.`);
      return;
    }

    for (const subject of subjects) {
      const entry = entriesBySubject[subject.id] ?? {
        heldText: '0',
        missedText: '0',
      };
      const held = parseWholeNumber(entry.heldText);
      const missed = parseWholeNumber(entry.missedText);
      if (held === null || missed === null) {
        setFormError(`Enter whole numbers for ${subject.name}.`);
        return;
      }
      if (missed > held) {
        setFormError(
          `Missed classes cannot be more than held classes for ${subject.name}.`
        );
        return;
      }
    }

    const hasExistingStartingCounts = subjects.some(
      (subject) => subject.initial_present > 0 || subject.initial_total > 0
    );

    if (hasExistingStartingCounts) {
      Alert.alert(
        'Replace starting counts',
        'This replaces the starting counts you entered before.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Replace',
            style: 'destructive',
            onPress: () => {
              void performSave();
            },
          },
        ]
      );
      return;
    }

    void performSave();
  };

  if (earliestLoading) {
    return (
      <View
        accessible
        accessibilityLabel="Loading estimate settings"
        style={styles.skeletonGroup}
      >
        <Skeleton width="100%" height={48} />
        <Skeleton width="60%" height={18} />
        <Skeleton width="100%" height={120} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loadError || formError ? (
        <View style={styles.errorBanner} accessibilityRole="alert">
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color={colors.danger}
            style={styles.errorIcon}
          />
          <AppText variant="caption" tone="danger" style={styles.errorText}>
            {formError ?? loadError}
          </AppText>
        </View>
      ) : null}

      <Card style={styles.rangeCard}>
        <DateField
          label="Semester start date"
          value={startDateText}
          onChangeText={handleStartDateChange}
          error={startDateRangeError}
          editable={!busy}
        />
        <AppText variant="caption" tone="muted">
          Counting up to {endDateDisplay}
        </AppText>
      </Card>

      {hasValidRange ? (
        <>
          <View style={styles.subjectList}>
            {subjects.map((subject) => {
              const entry = entriesBySubject[subject.id] ?? {
                heldText: '0',
                missedText: '0',
              };
              const held = parseWholeNumber(entry.heldText);
              const missed = parseWholeNumber(entry.missedText);
              const countsValid =
                held !== null && missed !== null && missed <= held;
              const attended = countsValid ? held - missed : 0;
              const percentText = countsValid
                ? formatDisplayPercent(attended, held)
                : formatDisplayPercent(0, 0);
              const rowError =
                held !== null && missed !== null && missed > held
                  ? 'Missed cannot be more than held.'
                  : undefined;

              return (
                <Card key={subject.id} style={styles.subjectCard}>
                  <AppText variant="heading" style={styles.subjectTitle}>
                    {subject.name}
                  </AppText>
                  <View style={styles.inputsRow}>
                    <TextField
                      label="Classes held (estimated)"
                      value={entry.heldText}
                      onChangeText={(value) =>
                        updateEntry(subject.id, { heldText: value })
                      }
                      keyboardType="number-pad"
                      maxLength={4}
                      editable={!busy}
                      containerStyle={styles.halfInput}
                    />
                    <TextField
                      label="Classes you missed"
                      value={entry.missedText}
                      onChangeText={(value) =>
                        updateEntry(subject.id, { missedText: value })
                      }
                      keyboardType="number-pad"
                      maxLength={4}
                      error={rowError}
                      editable={!busy}
                      containerStyle={styles.halfInput}
                    />
                  </View>
                  <AppText variant="label" tone="muted" style={styles.computedLine}>
                    Attended: {attended}, Percentage: {percentText}
                  </AppText>
                </Card>
              );
            })}
          </View>

          <Card style={styles.summaryCard}>
            <AppText variant="label">
              Estimated overall: {overallSummary.attended} of{' '}
              {overallSummary.held} ({overallSummary.percent})
            </AppText>
            <AppText variant="caption" tone="muted">
              Compare this with your college portal. If it is far off, adjust
              the missed numbers.
            </AppText>
          </Card>

          <View style={styles.warningCard}>
            <Ionicons
              name="warning-outline"
              size={18}
              color={colors.warn}
              style={styles.warningIcon}
            />
            <AppText variant="caption" style={styles.warningText}>
              This is an estimate. The timetable does not know about holidays or
              cancelled classes, so edit the held number if it is wrong.
            </AppText>
          </View>

          <Button
            title="Save estimate"
            onPress={handlePressSave}
            loading={saving}
            disabled={busy}
            fullWidth
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  skeletonGroup: {
    gap: spacing.md,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.dangerBg,
    borderRadius: radius.control,
    padding: spacing.md,
  },
  errorIcon: {
    marginRight: spacing.sm,
    marginTop: 1,
  },
  errorText: {
    flex: 1,
  },
  rangeCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  subjectList: {
    gap: spacing.md,
  },
  subjectCard: {
    padding: spacing.md,
    gap: spacing.md,
  },
  subjectTitle: {
    fontSize: 16,
  },
  inputsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  computedLine: {
    fontVariant: ['tabular-nums'],
  },
  summaryCard: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.warnBg,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  warningIcon: {
    marginRight: spacing.sm,
    marginTop: 1,
  },
  warningText: {
    flex: 1,
    color: colors.warn,
  },
});
