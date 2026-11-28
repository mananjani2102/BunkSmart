import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ContentFade } from '@/components/ui/ContentFade';
import { DATE_FORMAT_ERROR, DateField } from '@/components/ui/DateField';
import { ErrorState } from '@/components/ui/ErrorState';
import { ModalFormLayout } from '@/components/ui/ModalFormLayout';
import { ModalFieldSkeleton } from '@/components/SkeletonLayouts';
import { TextField } from '@/components/ui/TextField';
import { useDataActions } from '@/context/DataProvider';
import { useSnackbarActions } from '@/context/SnackbarProvider';
import { fetchEarliestLogDate } from '@/data/logs';
import { formatDisplayPercent } from '@/lib/attendance';
import {
  addDays,
  countWeekdayOccurrences,
  formatDateDDMMYYYY,
  getTodayDateString,
  parseTypedDate,
} from '@/lib/dates';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, type ThemeColors } from '@/theme/tokens';
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
  header?: ReactNode;
}

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  skeletonGroup: {
    gap: spacing.md,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.destructiveBg,
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
    gap: spacing.lg,
  },
  subjectCard: {
    padding: spacing.md,
    gap: spacing.md,
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
    backgroundColor: colors.warningBg,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  warningIcon: {
    marginRight: spacing.sm,
    marginTop: 1,
  },
  warningText: {
    flex: 1,
  },
}));

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

interface EstimateSubjectCardProps {
  subjectId: string;
  subjectName: string;
  heldText: string;
  missedText: string;
  busy: boolean;
  onChangeEntry: (
    subjectId: string,
    patch: Partial<EstimateSubjectEntry>
  ) => void;
}

const EstimateSubjectCard = memo(function EstimateSubjectCard({
  subjectId,
  subjectName,
  heldText,
  missedText,
  busy,
  onChangeEntry,
}: EstimateSubjectCardProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);

  const held = parseWholeNumber(heldText);
  const missed = parseWholeNumber(missedText);
  const countsValid = held !== null && missed !== null && missed <= held;
  const attended = countsValid ? held - missed : 0;
  const percentText = countsValid
    ? formatDisplayPercent(attended, held)
    : formatDisplayPercent(0, 0);
  const rowError =
    held !== null && missed !== null && missed > held
      ? 'Missed cannot be more than held.'
      : undefined;

  return (
    <Card style={styles.subjectCard}>
      <AppText variant="heading">{subjectName}</AppText>
      <View style={styles.inputsRow}>
        <TextField
          label="Classes held (estimated)"
          value={heldText}
          onChangeText={(value) => onChangeEntry(subjectId, { heldText: value })}
          keyboardType="number-pad"
          maxLength={4}
          editable={!busy}
          containerStyle={styles.halfInput}
        />
        <TextField
          label="Classes you missed"
          value={missedText}
          onChangeText={(value) =>
            onChangeEntry(subjectId, { missedText: value })
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
});

export function PastAttendanceEstimate({
  subjects,
  slots,
  busy,
  onBusyChange,
  header,
}: PastAttendanceEstimateProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const { updateSubjectsStartingCounts } = useDataActions();
  const { showSnackbar } = useSnackbarActions();

  const [earliestLoading, setEarliestLoading] = useState(true);
  const [earliestLogDate, setEarliestLogDate] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [startDateText, setStartDateText] = useState('');
  const [entriesBySubject, setEntriesBySubject] = useState<
    Record<string, EstimateSubjectEntry>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [replaceModalVisible, setReplaceModalVisible] = useState(false);

  const [reloadTick, setReloadTick] = useState(0);

  const mountedRef = useRef(true);
  const savingRef = useRef(false);

  const handleRetryEarliest = useCallback(() => {
    setEarliestLoading(true);
    setLoadError(null);
    setReloadTick((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;

    const load = async () => {
      try {
        const earliest = await fetchEarliestLogDate();
        if (!cancelled && mountedRef.current) {
          setEarliestLogDate(earliest);
          setLoadError(null);
        }
      } catch (err) {
        if (!cancelled && mountedRef.current) {
          setLoadError(getFriendlyErrorMessage(err));
        }
      } finally {
        if (!cancelled && mountedRef.current) {
          setEarliestLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [reloadTick]);

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

  const updateEntry = useCallback(
    (subjectId: string, patch: Partial<EstimateSubjectEntry>) => {
      setFormError((prev) => (prev ? null : prev));
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
    },
    []
  );

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
        setFormError(`Enter whole numbers for ${subject.name}.`);
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
      await updateSubjectsStartingCounts(parsedUpdates);
      showSnackbar('Past attendance saved.');
      router.back();
    } catch (err) {
      const message = getFriendlyErrorMessage(err);
      showSnackbar({ message, tone: 'error' });
      if (mountedRef.current) {
        setFormError(message);
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
      setReplaceModalVisible(true);
      return;
    }

    void performSave();
  };

  const footer = (
    <Button
      title="Save estimate"
      onPress={handlePressSave}
      loading={saving}
      disabled={busy || earliestLoading || !hasValidRange}
      fullWidth
    />
  );

  return (
    <ModalFormLayout footer={footer}>
      {header}

      <ContentFade
        loading={earliestLoading}
        fallback={<ModalFieldSkeleton rows={3} />}
        style={styles.skeletonGroup}
      >
        {loadError ? (
          <ErrorState
            message={loadError}
            onRetry={handleRetryEarliest}
          />
        ) : (
          <>
            {formError ? (
              <View style={styles.errorBanner} accessibilityRole="alert">
                <Ionicons
                  name="alert-circle-outline"
                  size={18}
                  color={colors.destructiveText}
                  style={styles.errorIcon}
                />
                <AppText variant="caption" tone="danger" style={styles.errorText}>
                  {formError}
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
                  return (
                    <EstimateSubjectCard
                      key={subject.id}
                      subjectId={subject.id}
                      subjectName={subject.name}
                      heldText={entry.heldText}
                      missedText={entry.missedText}
                      busy={busy}
                      onChangeEntry={updateEntry}
                    />
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
                  color={colors.warningText}
                  style={styles.warningIcon}
                />
                <AppText
                  variant="caption"
                  tone="warning"
                  style={styles.warningText}
                >
                  This is an estimate. The timetable does not know about holidays or
                  cancelled classes, so edit the held number if it is wrong.
                </AppText>
              </View>
            </>
          ) : null}

          <ConfirmModal
            visible={replaceModalVisible}
            title="Replace starting counts"
            message="This replaces the starting counts you entered before."
            confirmLabel="Replace"
            destructive
            loading={saving}
            error={formError}
            onCancel={() => setReplaceModalVisible(false)}
            onConfirm={() => {
              setReplaceModalVisible(false);
              void performSave();
            }}
          />
          </>
        )}
      </ContentFade>
    </ModalFormLayout>
  );
}
