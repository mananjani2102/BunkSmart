import { memo, useCallback } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import {
  formatAttendanceActionText,
  getLevelFillColor,
  getLevelLabel,
} from '@/components/ui/LevelBadge';
import {
  clampTarget,
  formatDisplayPercent,
  getAttendanceLevel,
} from '@/lib/attendance';
import { formatTime12Hour, timeStringToMinutes } from '@/lib/dates';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import {
  fontFamily,
  radius,
  spacing,
  type ThemeColors,
} from '@/theme/tokens';
import {
  type AttendanceStatus,
  type Subject,
  type TimetableSlot,
} from '@/types/db';

export interface TodayClassCardProps {
  slot: TimetableSlot;
  subject: Subject;
  attended: number;
  held: number;
  status: AttendanceStatus | null;
  pending: boolean;
  isNow?: boolean;
  isNext?: boolean;
  onSelectStatus: (
    slot: TimetableSlot,
    subject: Subject,
    nextStatus: AttendanceStatus
  ) => void;
}

interface StatusOption {
  value: AttendanceStatus;
  label: string;
}

const STATUS_OPTIONS: readonly StatusOption[] = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'cancelled', label: 'Cancelled' },
];

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  timeText: {
    flex: 1,
    fontVariant: ['tabular-nums'],
  },
  nowBadge: {
    backgroundColor: colors.primary,
    borderRadius: radius.small,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  nowBadgeText: {
    color: colors.primaryForeground,
    fontFamily: fontFamily.semibold,
  },
  nextBadge: {
    backgroundColor: colors.secondary,
    borderRadius: radius.small,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  nextBadgeText: {
    color: colors.foreground,
    fontFamily: fontFamily.medium,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  subjectName: {
    flex: 1,
  },
  percentText: {
    fontVariant: ['tabular-nums'],
  },
  statusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: radius.dot,
  },
  statusText: {
    flex: 1,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: colors.muted,
    borderRadius: radius.control,
    padding: 2,
    gap: 2,
    marginTop: spacing.xs,
  },
  segmentButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.small,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    overflow: 'hidden',
  },
  segmentPresent: {
    backgroundColor: colors.successBg,
  },
  segmentAbsent: {
    backgroundColor: colors.destructiveBg,
  },
  segmentCancelled: {
    backgroundColor: colors.secondary,
  },
  segmentPressed: {
    opacity: 0.78,
  },
  segmentDisabled: {
    opacity: 0.5,
  },
  segmentLabelDefault: {
    fontFamily: fontFamily.medium,
    color: colors.mutedForeground,
  },
  segmentLabelPresent: {
    fontFamily: fontFamily.semibold,
    color: colors.success,
  },
  segmentLabelAbsent: {
    fontFamily: fontFamily.semibold,
    color: colors.destructiveText,
  },
  segmentLabelCancelled: {
    fontFamily: fontFamily.semibold,
    color: colors.foreground,
  },
}));

function formatSlotTimeRange(slot: TimetableSlot): string {
  const start = formatTime12Hour(slot.start_time);
  if (!slot.end_time) {
    return start;
  }
  return `${start} to ${formatTime12Hour(slot.end_time)}`;
}

function formatSlotDuration(
  startStr: string,
  endStr: string | null
): string | null {
  if (!endStr) {
    return null;
  }
  try {
    const diff = timeStringToMinutes(endStr) - timeStringToMinutes(startStr);
    if (diff <= 0) {
      return null;
    }
    if (diff >= 60) {
      const hours = Math.floor(diff / 60);
      const mins = diff % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${diff}m`;
  } catch {
    return null;
  }
}

function formatCompactStatusLine(
  attended: number,
  held: number,
  target: number
): string {
  if (held <= 0) {
    return 'No classes counted yet';
  }
  const action = formatAttendanceActionText(attended, held, target);
  const lowerAction = `${action.charAt(0).toLowerCase()}${action.slice(1)}`;
  return `${attended} of ${held} attended, ${lowerAction}`;
}

interface SegmentButtonProps {
  option: StatusOption;
  slot: TimetableSlot;
  subject: Subject;
  selected: boolean;
  pending: boolean;
  onSelectStatus: (
    slot: TimetableSlot,
    subject: Subject,
    nextStatus: AttendanceStatus
  ) => void;
}

const SegmentButton = memo(function SegmentButton({
  option,
  slot,
  subject,
  selected,
  pending,
  onSelectStatus,
}: SegmentButtonProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);

  const handlePress = useCallback(() => {
    onSelectStatus(slot, subject, option.value);
  }, [onSelectStatus, option.value, slot, subject]);

  const activeBgStyle = !selected
    ? undefined
    : option.value === 'present'
      ? styles.segmentPresent
      : option.value === 'absent'
        ? styles.segmentAbsent
        : styles.segmentCancelled;

  const labelStyle = !selected
    ? styles.segmentLabelDefault
    : option.value === 'present'
      ? styles.segmentLabelPresent
      : option.value === 'absent'
        ? styles.segmentLabelAbsent
        : styles.segmentLabelCancelled;

  return (
    <Pressable
      onPress={handlePress}
      disabled={pending}
      hitSlop={4}
      android_ripple={
        !pending ? { color: colors.rippleNeutral, foreground: true } : undefined
      }
      accessibilityRole="button"
      accessibilityLabel={`${option.label} for ${subject.name}, ${selected ? 'selected' : 'not selected'}`}
      accessibilityState={{ selected, disabled: pending, busy: pending }}
      style={({ pressed }) => [
        styles.segmentButton,
        activeBgStyle,
        pending && styles.segmentDisabled,
        pressed && !pending && styles.segmentPressed,
      ]}
    >
      <AppText
        variant="label"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={labelStyle}
      >
        {option.label}
      </AppText>
    </Pressable>
  );
});

export const TodayClassCard = memo(function TodayClassCard({
  slot,
  subject,
  attended,
  held,
  status,
  pending,
  isNow = false,
  isNext = false,
  onSelectStatus,
}: TodayClassCardProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);

  const timeRange = formatSlotTimeRange(slot);
  const duration = formatSlotDuration(slot.start_time, slot.end_time);
  const timeLabel = duration ? `${timeRange}, ${duration}` : timeRange;
  const percentText = formatDisplayPercent(attended, held);
  const target = clampTarget(subject.target_percent);
  const level = getAttendanceLevel(attended, held, target);
  const levelLabel = getLevelLabel(level);
  const dotColor = getLevelFillColor(level, colors);
  const statusLine = formatCompactStatusLine(attended, held, target);
  const markedLabel =
    status === 'present'
      ? 'Marked present'
      : status === 'absent'
        ? 'Marked absent'
        : status === 'cancelled'
          ? 'Marked cancelled'
          : 'Not marked';

  return (
    <Card style={styles.card}>
      <View style={styles.timeRow}>
        <AppText
          variant="caption"
          tone="muted"
          numberOfLines={1}
          style={styles.timeText}
        >
          {timeLabel}
        </AppText>
        {isNow ? (
          <View style={styles.nowBadge}>
            <AppText variant="caption" style={styles.nowBadgeText}>
              Now
            </AppText>
          </View>
        ) : isNext ? (
          <View style={styles.nextBadge}>
            <AppText variant="caption" style={styles.nextBadgeText}>
              Next
            </AppText>
          </View>
        ) : null}
      </View>

      <View
        accessible
        accessibilityLabel={`${subject.name}, ${percentText}, ${markedLabel}`}
        style={styles.titleRow}
      >
        <AppText
          variant="heading"
          numberOfLines={1}
          style={styles.subjectName}
        >
          {subject.name}
        </AppText>
        <AppText variant="heading" style={styles.percentText}>
          {percentText}
        </AppText>
      </View>

      <View
        accessible
        accessibilityLabel={`${levelLabel}, ${statusLine}`}
        style={styles.statusLine}
      >
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={[styles.statusDot, { backgroundColor: dotColor }]}
        />
        <AppText
          variant="caption"
          tone="muted"
          numberOfLines={2}
          style={styles.statusText}
        >
          {statusLine}
        </AppText>
      </View>

      <View style={styles.segmentedContainer}>
        {STATUS_OPTIONS.map((option) => (
          <SegmentButton
            key={option.value}
            option={option}
            slot={slot}
            subject={subject}
            selected={status === option.value}
            pending={pending}
            onSelectStatus={onSelectStatus}
          />
        ))}
      </View>
    </Card>
  );
});
