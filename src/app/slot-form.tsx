import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Segmented, type SegmentedOption } from '@/components/ui/Segmented';
import { Skeleton } from '@/components/ui/Skeleton';
import { TimeField } from '@/components/ui/TimeField';
import { useData } from '@/context/DataProvider';
import {
  getIsoWeekday,
  getTodayDateString,
  LONG_WEEKDAYS,
  minutesToTimeString,
  SHORT_WEEKDAYS,
  timeStringToMinutes,
} from '@/lib/dates';
import { AppError, getFriendlyErrorMessage } from '@/lib/errors';
import { colors, radius, spacing } from '@/theme/tokens';
import { type TimetableSlot } from '@/types/db';

const MODAL_EDGES = ['bottom', 'left', 'right'] as const;
const DEFAULT_START_TIME = '09:00:00';
const MAX_SLOT_MINUTES = 23 * 60 + 55;

const WEEKDAY_OPTIONS: readonly SegmentedOption<number>[] = SHORT_WEEKDAYS.map(
  (label, index) => ({
    label,
    value: index + 1,
    accessibilityLabel: LONG_WEEKDAYS[index],
  })
);

function parseWeekdayParam(raw: string | undefined): number {
  if (raw) {
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 7) {
      return parsed;
    }
  }
  return getIsoWeekday(getTodayDateString());
}

function addOneHour(timeStr: string): string {
  try {
    const minutes = timeStringToMinutes(timeStr);
    const next = Math.min(MAX_SLOT_MINUTES, minutes + 60);
    return minutesToTimeString(next);
  } catch {
    return '10:00:00';
  }
}

interface SlotFormBodyProps {
  existingSlot?: TimetableSlot;
  defaultWeekday: number;
}

function SlotFormBody({ existingSlot, defaultWeekday }: SlotFormBodyProps) {
  const { subjects, addSlot, updateSlot, deleteSlot } = useData();
  const isEditing = Boolean(existingSlot);

  const initialStart = existingSlot?.start_time ?? DEFAULT_START_TIME;
  const initialEnd = existingSlot?.end_time ?? addOneHour(initialStart);

  const [selectedSubjectId, setSelectedSubjectId] = useState(
    existingSlot?.subject_id ?? ''
  );
  const [weekday, setWeekday] = useState(
    existingSlot?.weekday ?? defaultWeekday
  );
  const [startTime, setStartTime] = useState(initialStart);
  const [endTime, setEndTime] = useState(initialEnd);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const busyRef = useRef(false);
  const endTouchedRef = useRef(Boolean(existingSlot?.end_time));

  const subjectId = selectedSubjectId || (!isEditing ? (subjects[0]?.id ?? '') : '');
  const busy = saving || deleting;

  const clearError = () => {
    if (formError) {
      setFormError(null);
    }
  };

  const handleStartTimeChange = (nextStart: string) => {
    setStartTime(nextStart);
    if (!endTouchedRef.current) {
      setEndTime(addOneHour(nextStart));
    }
    clearError();
  };

  const handleEndTimeChange = (nextEnd: string) => {
    endTouchedRef.current = true;
    setEndTime(nextEnd);
    clearError();
  };

  const handleSave = async () => {
    if (busyRef.current) {
      return;
    }

    if (!subjectId) {
      setFormError('Select a subject.');
      return;
    }

    if (timeStringToMinutes(endTime) <= timeStringToMinutes(startTime)) {
      setFormError('End time must be later than start time.');
      return;
    }

    busyRef.current = true;
    setSaving(true);
    setFormError(null);

    try {
      const input = {
        subject_id: subjectId,
        weekday,
        start_time: startTime,
        end_time: endTime,
      };

      if (existingSlot) {
        await updateSlot(existingSlot.id, input);
      } else {
        await addSlot(input);
      }

      router.back();
    } catch (err) {
      if (!(err instanceof AppError)) {
        console.error('Save class failed:', err);
      }
      setFormError(getFriendlyErrorMessage(err));
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (busyRef.current || !existingSlot) {
      return;
    }

    busyRef.current = true;
    setDeleting(true);
    setFormError(null);

    try {
      await deleteSlot(existingSlot.id);
      router.back();
    } catch (err) {
      if (!(err instanceof AppError)) {
        console.error('Delete class failed:', err);
      }
      setFormError(getFriendlyErrorMessage(err));
    } finally {
      busyRef.current = false;
      setDeleting(false);
    }
  };

  const handleConfirmDelete = () => {
    if (busyRef.current || !existingSlot) {
      return;
    }

    Alert.alert(
      'Delete class',
      'Delete this class from your weekly timetable? Past attendance records stay saved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void handleDelete();
          },
        },
      ]
    );
  };

  return (
    <Screen scroll edges={MODAL_EDGES} contentContainerStyle={styles.content}>
      {formError ? (
        <View style={styles.errorBanner} accessibilityRole="alert">
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color={colors.danger}
            style={styles.errorIcon}
          />
          <AppText variant="caption" tone="danger" style={styles.errorText}>
            {formError}
          </AppText>
        </View>
      ) : null}

      <View style={styles.section}>
        <AppText variant="label">Subject</AppText>

        {subjects.length === 0 ? (
          <AppText variant="body" tone="muted">
            Add a subject before building your timetable.
          </AppText>
        ) : (
          <View style={styles.radioList} accessibilityRole="radiogroup">
            {subjects.map((subject) => {
              const selected = subject.id === subjectId;
              return (
                <PressableScale
                  key={subject.id}
                  onPress={() => {
                    if (!busy) {
                      setSelectedSubjectId(subject.id);
                      clearError();
                    }
                  }}
                  disabled={busy}
                  scaleTo={0.985}
                  rippleColor={colors.rippleNeutral}
                  accessibilityRole="radio"
                  accessibilityLabel={subject.name}
                  accessibilityState={{ selected, disabled: busy }}
                  containerStyle={[
                    styles.radioRowContainer,
                    selected && styles.radioRowSelected,
                  ]}
                  style={({ pressed }) => [
                    styles.radioRow,
                    pressed && !busy && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={selected ? colors.accent : colors.textMuted}
                    style={styles.radioIcon}
                  />
                  <AppText
                    variant="body"
                    numberOfLines={2}
                    style={styles.radioText}
                  >
                    {subject.name}
                  </AppText>
                </PressableScale>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <AppText variant="label">Day</AppText>
        <Segmented
          options={WEEKDAY_OPTIONS}
          value={weekday}
          onChange={(nextDay) => {
            setWeekday(nextDay);
            clearError();
          }}
          compact
          disabled={busy}
        />
      </View>

      <TimeField
        label="Starts at"
        value={startTime}
        onChange={handleStartTimeChange}
        disabled={busy}
      />

      <TimeField
        label="Ends at"
        value={endTime}
        onChange={handleEndTimeChange}
        disabled={busy}
      />

      <View style={styles.actions}>
        <Button
          title="Save class"
          onPress={() => {
            void handleSave();
          }}
          loading={saving}
          disabled={busy || subjects.length === 0}
          fullWidth
        />
        {isEditing ? (
          <Button
            title="Delete class"
            variant="danger"
            onPress={handleConfirmDelete}
            loading={deleting}
            disabled={busy}
            fullWidth
          />
        ) : null}
      </View>
    </Screen>
  );
}

export default function SlotFormScreen() {
  const params = useLocalSearchParams<{ id?: string; weekday?: string }>();
  const slotId =
    typeof params.id === 'string' && params.id.length > 0
      ? params.id
      : undefined;

  const { slots, status } = useData();
  const existingSlot = slotId
    ? slots.find((item) => item.id === slotId)
    : undefined;
  const isEditing = Boolean(slotId);
  const title = isEditing ? 'Edit class' : 'New class';

  if (isEditing && !existingSlot) {
    return (
      <Screen edges={MODAL_EDGES}>
        <Stack.Screen options={{ title }} />
        <View style={styles.missingContainer}>
          {status === 'loading' ? (
            <View
              accessible
              accessibilityLabel="Loading class"
              style={styles.skeletonGroup}
            >
              <Skeleton width="45%" height={18} />
              <Skeleton width="100%" height={48} />
              <Skeleton width="100%" height={48} />
            </View>
          ) : (
            <>
              <AppText variant="body" tone="muted">
                Class not found.
              </AppText>
              <Button
                title="Go back"
                variant="secondary"
                onPress={() => router.back()}
                style={styles.missingButton}
              />
            </>
          )}
        </View>
      </Screen>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title }} />
      <SlotFormBody
        key={existingSlot?.id ?? 'new'}
        existingSlot={existingSlot}
        defaultWeekday={parseWeekdayParam(params.weekday)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
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
  section: {
    gap: spacing.sm,
  },
  radioList: {
    gap: spacing.sm,
  },
  radioRowContainer: {
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 46,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  radioRowSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  radioIcon: {
    marginRight: spacing.md,
  },
  radioText: {
    flex: 1,
  },
  pressed: {
    backgroundColor: colors.surfacePressed,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  missingContainer: {
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  skeletonGroup: {
    gap: spacing.md,
  },
  missingButton: {
    alignSelf: 'flex-start',
  },
});
