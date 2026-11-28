import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ModalFieldSkeleton } from '@/components/SkeletonLayouts';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ModalFormLayout } from '@/components/ui/ModalFormLayout';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Segmented, type SegmentedOption } from '@/components/ui/Segmented';
import { TimeField } from '@/components/ui/TimeField';
import { useDataActions, useDataState } from '@/context/DataProvider';
import { useSnackbarActions } from '@/context/SnackbarProvider';
import {
  getIsoWeekday,
  getTodayDateString,
  LONG_WEEKDAYS,
  minutesToTimeString,
  SHORT_WEEKDAYS,
  timeStringToMinutes,
} from '@/lib/dates';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import {
  fontFamily,
  radius,
  spacing,
  type ThemeColors,
} from '@/theme/tokens';
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

const getStyles = createThemedStyles((colors: ThemeColors) => ({
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
    backgroundColor: colors.card,
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
    borderColor: colors.foreground,
    backgroundColor: colors.muted,
  },
  radioIcon: {
    marginRight: spacing.md,
  },
  radioText: {
    flex: 1,
  },
  pressed: {
    backgroundColor: colors.muted,
  },
  destructiveTextBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.control,
    overflow: 'hidden',
  },
  destructiveTextBtnPressed: {
    backgroundColor: colors.destructiveBg,
  },
  destructiveTextLabel: {
    fontFamily: fontFamily.medium,
  },
  missingContainer: {
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  missingButton: {
    alignSelf: 'flex-start',
  },
}));

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

interface SubjectRadioRowProps {
  id: string;
  name: string;
  selected: boolean;
  disabled: boolean;
  onSelect: (subjectId: string) => void;
}

const SubjectRadioRow = memo(function SubjectRadioRow({
  id,
  name,
  selected,
  disabled,
  onSelect,
}: SubjectRadioRowProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);

  return (
    <PressableScale
      onPress={() => {
        if (!disabled) {
          onSelect(id);
        }
      }}
      disabled={disabled}
      scaleTo={0.985}
      rippleColor={colors.rippleNeutral}
      accessibilityRole="radio"
      accessibilityLabel={name}
      accessibilityState={{ selected, disabled }}
      containerStyle={[
        styles.radioRowContainer,
        selected && styles.radioRowSelected,
      ]}
      style={({ pressed }) => [
        styles.radioRow,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={20}
        color={selected ? colors.foreground : colors.mutedForeground}
        style={styles.radioIcon}
      />
      <AppText variant="body" numberOfLines={2} style={styles.radioText}>
        {name}
      </AppText>
    </PressableScale>
  );
});

interface SlotFormBodyProps {
  existingSlot?: TimetableSlot;
  defaultWeekday: number;
}

function SlotFormBody({ existingSlot, defaultWeekday }: SlotFormBodyProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const { subjects } = useDataState();
  const { addSlot, updateSlot, deleteSlot } = useDataActions();
  const { showSnackbar } = useSnackbarActions();
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
  const [timeError, setTimeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const busyRef = useRef(false);
  const endTouchedRef = useRef(Boolean(existingSlot?.end_time));

  const subjectId =
    selectedSubjectId || (!isEditing ? (subjects[0]?.id ?? '') : '');
  const busy = saving || deleting;

  const clearError = useCallback(() => {
    setFormError((prev) => (prev ? null : prev));
    setTimeError((prev) => (prev ? null : prev));
  }, []);

  const handleSelectSubject = useCallback(
    (nextId: string) => {
      setSelectedSubjectId(nextId);
      clearError();
    },
    [clearError]
  );

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
      setTimeError('End time must be later than start time.');
      return;
    }

    busyRef.current = true;
    setSaving(true);
    setTimeError(null);
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
        showSnackbar('Class saved.');
      } else {
        await addSlot(input);
        showSnackbar('Class added.');
      }

      router.back();
    } catch (err) {
      const message = getFriendlyErrorMessage(err);
      setFormError(message);
      showSnackbar({ message, tone: 'error' });
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
      setDeleteModalVisible(false);
      showSnackbar('Class deleted.');
      router.back();
    } catch (err) {
      const message = getFriendlyErrorMessage(err);
      setFormError(message);
      showSnackbar({ message, tone: 'error' });
    } finally {
      busyRef.current = false;
      setDeleting(false);
    }
  };

  const handleConfirmDelete = () => {
    if (busyRef.current || !existingSlot) {
      return;
    }

    setFormError(null);
    setDeleteModalVisible(true);
  };

  return (
    <ModalFormLayout
      footer={
        <Button
          title="Save class"
          onPress={() => {
            void handleSave();
          }}
          loading={saving}
          disabled={busy || subjects.length === 0}
          fullWidth
        />
      }
    >
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

      <View style={styles.section}>
        <AppText variant="label">Subject</AppText>

        {subjects.length === 0 ? (
          <AppText variant="body" tone="muted">
            Add a subject before building your timetable.
          </AppText>
        ) : (
          <View style={styles.radioList} accessibilityRole="radiogroup">
            {subjects.map((subject) => (
              <SubjectRadioRow
                key={subject.id}
                id={subject.id}
                name={subject.name}
                selected={subject.id === subjectId}
                disabled={busy}
                onSelect={handleSelectSubject}
              />
            ))}
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

      <View style={styles.section}>
        <TimeField
          label="Ends at"
          value={endTime}
          onChange={handleEndTimeChange}
          disabled={busy}
        />
        {timeError ? (
          <AppText variant="caption" tone="danger">
            {timeError}
          </AppText>
        ) : null}
      </View>

      {isEditing ? (
        <Pressable
          onPress={handleConfirmDelete}
          disabled={busy}
          android_ripple={
            !busy ? { color: colors.rippleNeutral, foreground: true } : undefined
          }
          accessibilityRole="button"
          accessibilityLabel="Delete class"
          style={({ pressed }) => [
            styles.destructiveTextBtn,
            pressed && !busy && styles.destructiveTextBtnPressed,
          ]}
        >
          <AppText
            variant="label"
            tone="danger"
            style={styles.destructiveTextLabel}
          >
            Delete class
          </AppText>
        </Pressable>
      ) : null}

      {existingSlot ? (
        <ConfirmModal
          visible={deleteModalVisible}
          title="Delete class"
          message="Delete this class from your weekly timetable? Past attendance records stay saved."
          confirmLabel="Delete"
          destructive
          loading={deleting}
          error={formError}
          onCancel={() => setDeleteModalVisible(false)}
          onConfirm={() => {
            void handleDelete();
          }}
        />
      ) : null}
    </ModalFormLayout>
  );
}

export default function SlotFormScreen() {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const params = useLocalSearchParams<{ id?: string; weekday?: string }>();
  const slotId =
    typeof params.id === 'string' && params.id.length > 0
      ? params.id
      : undefined;

  const { slots, status } = useDataState();
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
            <ModalFieldSkeleton rows={4} />
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
