import { memo, useCallback } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { EmptyState } from '@/components/ui/EmptyState';
import { FadeView } from '@/components/ui/FadeView';
import { formatTime12Hour, LONG_WEEKDAYS, SHORT_WEEKDAYS } from '@/lib/dates';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import {
  fontFamily,
  radius,
  spacing,
  type ThemeColors,
} from '@/theme/tokens';
import { type Subject, type TimetableSlot } from '@/types/db';

export interface TimetableDayViewProps {
  selectedWeekday: number;
  todayWeekday: number;
  daySlots: readonly TimetableSlot[];
  subjectById: Record<string, Subject>;
  onSelectWeekday: (weekday: number) => void;
  onAddClass: () => void;
  onEditSlot: (slotId: string) => void;
}

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  container: {
    marginTop: spacing.lg,
    gap: spacing.lg,
  },
  dayRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dayCell: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.xs + 2,
    overflow: 'hidden',
  },
  dayCellSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayCellPressed: {
    backgroundColor: colors.muted,
  },
  dayLabel: {
    fontFamily: fontFamily.medium,
    color: colors.foreground,
  },
  dayLabelSelected: {
    fontFamily: fontFamily.semibold,
    color: colors.primaryForeground,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: radius.dot,
    backgroundColor: colors.primary,
  },
  todayDotSelected: {
    backgroundColor: colors.primaryForeground,
  },
  todayDotPlaceholder: {
    width: 4,
    height: 4,
  },
  listGroup: {
    gap: spacing.md,
  },
  groupedCard: {
    padding: 0,
    overflow: 'hidden',
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  slotRowPressed: {
    backgroundColor: colors.muted,
  },
  timeCol: {
    minWidth: 84,
    gap: 2,
  },
  startTimeText: {
    fontFamily: fontFamily.medium,
    fontVariant: ['tabular-nums'],
  },
  endTimeText: {
    fontVariant: ['tabular-nums'],
  },
  subjectNameText: {
    flex: 1,
    fontFamily: fontFamily.medium,
  },
}));

interface DayCellProps {
  dayNumber: number;
  label: string;
  longLabel: string;
  isSelected: boolean;
  isToday: boolean;
  onSelect: (dayNumber: number) => void;
}

const DayCell = memo(function DayCell({
  dayNumber,
  label,
  longLabel,
  isSelected,
  isToday,
  onSelect,
}: DayCellProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);

  const handlePress = useCallback(() => {
    onSelect(dayNumber);
  }, [dayNumber, onSelect]);

  return (
    <Pressable
      onPress={handlePress}
      android_ripple={{
        color: isSelected ? colors.ripplePrimary : colors.rippleNeutral,
        foreground: true,
      }}
      accessibilityRole="button"
      accessibilityLabel={`${longLabel}${isToday ? ', Today' : ''}`}
      accessibilityState={{ selected: isSelected }}
      style={({ pressed }) => [
        styles.dayCell,
        isSelected && styles.dayCellSelected,
        pressed && !isSelected && styles.dayCellPressed,
      ]}
    >
      <AppText
        variant="caption"
        style={isSelected ? styles.dayLabelSelected : styles.dayLabel}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label}
      </AppText>
      {isToday ? (
        <View
          style={[styles.todayDot, isSelected && styles.todayDotSelected]}
        />
      ) : (
        <View style={styles.todayDotPlaceholder} />
      )}
    </Pressable>
  );
});

interface TimetableSlotRowProps {
  slot: TimetableSlot;
  subjectName: string;
  onEdit: (slotId: string) => void;
}

const TimetableSlotRow = memo(function TimetableSlotRow({
  slot,
  subjectName,
  onEdit,
}: TimetableSlotRowProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);

  const handlePress = useCallback(() => {
    onEdit(slot.id);
  }, [onEdit, slot.id]);

  const startTime = formatTime12Hour(slot.start_time);
  const endTime = slot.end_time ? formatTime12Hour(slot.end_time) : null;

  return (
    <Pressable
      onPress={handlePress}
      android_ripple={{ color: colors.rippleNeutral, foreground: true }}
      accessibilityRole="button"
      accessibilityLabel={`${subjectName}, ${startTime}${endTime ? ` to ${endTime}` : ''}`}
      style={({ pressed }) => [styles.slotRow, pressed && styles.slotRowPressed]}
    >
      <View style={styles.timeCol}>
        <AppText variant="label" style={styles.startTimeText}>
          {startTime}
        </AppText>
        {endTime ? (
          <AppText variant="caption" tone="muted" style={styles.endTimeText}>
            {endTime}
          </AppText>
        ) : null}
      </View>

      <AppText variant="body" numberOfLines={2} style={styles.subjectNameText}>
        {subjectName}
      </AppText>
    </Pressable>
  );
});

export function TimetableDayView({
  selectedWeekday,
  todayWeekday,
  daySlots,
  subjectById,
  onSelectWeekday,
  onAddClass,
  onEditSlot,
}: TimetableDayViewProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const selectedWeekdayName = LONG_WEEKDAYS[selectedWeekday - 1];

  return (
    <View style={styles.container}>
      <View style={styles.dayRow}>
        {SHORT_WEEKDAYS.map((dayLabel, index) => {
          const dayNumber = index + 1;
          return (
            <DayCell
              key={`day-cell-${dayNumber}`}
              dayNumber={dayNumber}
              label={dayLabel}
              longLabel={LONG_WEEKDAYS[index]}
              isSelected={selectedWeekday === dayNumber}
              isToday={todayWeekday === dayNumber}
              onSelect={onSelectWeekday}
            />
          );
        })}
      </View>

      <FadeView transitionKey={selectedWeekday}>
        {daySlots.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="No classes scheduled"
            message={`No classes are scheduled on ${selectedWeekdayName}.`}
            actionLabel="Add class"
            onAction={onAddClass}
          />
        ) : (
          <View style={styles.listGroup}>
            <Card style={styles.groupedCard}>
              {daySlots.map((slot, index) => {
                const subject = subjectById[slot.subject_id];
                return (
                  <View key={slot.id}>
                    {index > 0 ? <Divider /> : null}
                    <TimetableSlotRow
                      slot={slot}
                      subjectName={subject?.name ?? 'Subject'}
                      onEdit={onEditSlot}
                    />
                  </View>
                );
              })}
            </Card>

            <Button
              title="Add class"
              variant="secondary"
              icon="add"
              fullWidth
              onPress={onAddClass}
            />
          </View>
        )}
      </FadeView>
    </View>
  );
}
