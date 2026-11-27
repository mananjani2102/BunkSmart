import { memo, useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { getLevelFillColor } from '@/components/ui/LevelBadge';
import { Stepper } from '@/components/ui/Stepper';
import {
  canSkip,
  clampTarget,
  formatDisplayPercent,
  formatPointsChange,
  getAttendanceLevel,
  getAttendanceRatio,
  getPercentTenths,
  meetsTarget,
  mustAttend,
  pluralizeClasses,
  projectAttendance,
  type AttendanceCounts,
} from '@/lib/attendance';
import { addDays, getIsoWeekday, getTodayDateString } from '@/lib/dates';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { spacing, type ThemeColors } from '@/theme/tokens';
import { type Subject, type TimetableSlot } from '@/types/db';

export interface WhatIfSimulatorProps {
  subject: Subject;
  counts: AttendanceCounts;
  slots: readonly TimetableSlot[];
}

const MAX_UPCOMING = 60;
const FALLBACK_UPCOMING = 4;

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  card: {
    gap: spacing.lg,
  },
  steppersRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  stepperCol: {
    flex: 1,
  },
  resultSection: {
    gap: spacing.sm,
  },
  percentRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  projectedPercent: {
    fontVariant: ['tabular-nums'],
  },
  deltaText: {
    fontVariant: ['tabular-nums'],
  },
  barWrapper: {
    height: 8,
    justifyContent: 'center',
    position: 'relative',
  },
  barTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.muted,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
  targetMarker: {
    position: 'absolute',
    top: 1,
    bottom: 1,
    width: 2,
    marginLeft: -1,
    backgroundColor: colors.foreground,
    borderRadius: 1,
  },
  presetButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  presetButton: {
    flex: 1,
  },
}));

function getInitialUpcoming(
  subjectId: string,
  slots: readonly TimetableSlot[]
): number {
  const subjectSlots = slots.filter((slot) => slot.subject_id === subjectId);
  if (subjectSlots.length === 0) {
    return FALLBACK_UPCOMING;
  }

  const countByWeekday: Record<number, number> = {};
  for (const slot of subjectSlots) {
    countByWeekday[slot.weekday] = (countByWeekday[slot.weekday] ?? 0) + 1;
  }

  const todayStr = getTodayDateString();
  let total = 0;
  for (let offset = 1; offset <= 7; offset += 1) {
    const weekday = getIsoWeekday(addDays(todayStr, offset));
    total += countByWeekday[weekday] ?? 0;
  }

  return Math.min(MAX_UPCOMING, total);
}

export const WhatIfSimulator = memo(function WhatIfSimulator({
  subject,
  counts,
  slots,
}: WhatIfSimulatorProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);

  const subjectHasSlots = slots.some((slot) => slot.subject_id === subject.id);

  const [prevSubjectId, setPrevSubjectId] = useState(subject.id);
  const [upcoming, setUpcoming] = useState(() =>
    getInitialUpcoming(subject.id, slots)
  );
  const [skip, setSkip] = useState(0);

  if (prevSubjectId !== subject.id) {
    setPrevSubjectId(subject.id);
    setUpcoming(getInitialUpcoming(subject.id, slots));
    setSkip(0);
  }

  const safeSkip = Math.min(skip, upcoming);
  const attendMore = upcoming - safeSkip;

  const handleUpcomingChange = (nextUpcoming: number) => {
    setUpcoming(nextUpcoming);
    if (safeSkip > nextUpcoming) {
      setSkip(nextUpcoming);
    }
  };

  const target = clampTarget(subject.target_percent);
  const projected = projectAttendance(
    counts.attended,
    counts.held,
    attendMore,
    safeSkip
  );

  const hasProjectedData = projected.held > 0;
  const projectedPercentText = formatDisplayPercent(
    projected.attended,
    projected.held
  );
  const projectedRatio = getAttendanceRatio(projected.attended, projected.held);
  const projectedLevel = getAttendanceLevel(
    projected.attended,
    projected.held,
    target
  );

  const currentTenths = getPercentTenths(counts.attended, counts.held);
  const projectedTenths = getPercentTenths(projected.attended, projected.held);
  const deltaText = formatPointsChange(currentTenths, projectedTenths);

  let verdictText: string | null = null;
  if (hasProjectedData) {
    if (meetsTarget(projected.attended, projected.held, target)) {
      const remainingSkips = canSkip(
        projected.attended,
        projected.held,
        target
      );
      verdictText = `Stays at or above ${target}%. Can skip ${remainingSkips} ${pluralizeClasses(remainingSkips)} after this.`;
    } else {
      const needed = mustAttend(projected.attended, projected.held, target);
      verdictText = `Drops below ${target}%. Attend next ${needed} ${pluralizeClasses(needed)} to reach ${target}%.`;
    }
  }

  const fillWidthPercent =
    projectedRatio === null ? 0 : Math.min(100, Math.max(0, projectedRatio));

  return (
    <Card style={styles.card}>
      <AppText variant="heading">What if you skip?</AppText>

      <View style={styles.steppersRow}>
        <Stepper
          label="Upcoming classes"
          layout="column"
          value={upcoming}
          min={0}
          max={MAX_UPCOMING}
          onChange={handleUpcomingChange}
          style={styles.stepperCol}
        />
        <Stepper
          label="Classes you skip"
          layout="column"
          value={safeSkip}
          min={0}
          max={upcoming}
          onChange={setSkip}
          style={styles.stepperCol}
        />
      </View>

      {!subjectHasSlots ? (
        <AppText variant="caption" tone="muted">
          Add this subject to your timetable to prefill this.
        </AppText>
      ) : null}

      <Divider />

      {!hasProjectedData ? (
        <View style={styles.resultSection}>
          <AppText variant="heading" tone="muted">
            No data
          </AppText>
        </View>
      ) : (
        <View style={styles.resultSection}>
          <View style={styles.percentRow}>
            <AppText variant="heading" style={styles.projectedPercent}>
              {projectedPercentText}
            </AppText>
            {deltaText ? (
              <AppText
                variant="label"
                tone={
                  projectedTenths !== null &&
                  currentTenths !== null &&
                  projectedTenths < currentTenths
                    ? 'danger'
                    : projectedTenths !== null &&
                        currentTenths !== null &&
                        projectedTenths > currentTenths
                      ? 'success'
                      : 'muted'
                }
                style={styles.deltaText}
              >
                {deltaText}
              </AppText>
            ) : null}
          </View>

          {verdictText ? (
            <AppText variant="body">{verdictText}</AppText>
          ) : null}

          <View
            accessible
            accessibilityLabel={`Projected attendance ${projectedPercentText}, target ${target} percent`}
            style={styles.barWrapper}
          >
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${fillWidthPercent}%`,
                    backgroundColor: getLevelFillColor(projectedLevel, colors),
                  },
                ]}
              />
            </View>
            <View
              pointerEvents="none"
              style={[styles.targetMarker, { left: `${target}%` }]}
            />
          </View>
        </View>
      )}

      <View style={styles.presetButtonsRow}>
        <Button
          title="Skip none"
          variant="secondary"
          onPress={() => setSkip(0)}
          disabled={safeSkip === 0}
          style={styles.presetButton}
        />
        <Button
          title="Skip all"
          variant="secondary"
          onPress={() => setSkip(upcoming)}
          disabled={upcoming === 0 || safeSkip === upcoming}
          style={styles.presetButton}
        />
      </View>
    </Card>
  );
});
