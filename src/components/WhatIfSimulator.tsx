import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LevelBadge } from '@/components/ui/LevelBadge';
import { Stepper } from '@/components/ui/Stepper';
import {
  canSkip,
  clampTarget,
  formatDisplayPercent,
  formatPointsChange,
  getAttendanceLevel,
  getAttendanceRatio,
  getPercentTenths,
  levelToTone,
  meetsTarget,
  mustAttend,
  pluralizeClasses,
  projectAttendance,
  type AttendanceCounts,
  type AttendanceTone,
} from '@/lib/attendance';
import { addDays, getIsoWeekday, getTodayDateString } from '@/lib/dates';
import { colors, radius, spacing } from '@/theme/tokens';
import { type Subject, type TimetableSlot } from '@/types/db';

export interface WhatIfSimulatorProps {
  subject: Subject;
  counts: AttendanceCounts;
  slots: readonly TimetableSlot[];
}

const MAX_UPCOMING = 60;
const FALLBACK_UPCOMING = 4;

const barFillColorMap: Record<AttendanceTone, string> = {
  safe: colors.safe,
  warn: colors.warn,
  danger: colors.danger,
  muted: colors.textMuted,
};

function getInitialUpcoming(
  subjectId: string,
  slots: readonly TimetableSlot[]
): { upcoming: number; hasSlots: boolean } {
  const subjectSlots = slots.filter((slot) => slot.subject_id === subjectId);
  if (subjectSlots.length === 0) {
    return { upcoming: FALLBACK_UPCOMING, hasSlots: false };
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

  return {
    upcoming: Math.min(MAX_UPCOMING, total),
    hasSlots: true,
  };
}

export function WhatIfSimulator({
  subject,
  counts,
  slots,
}: WhatIfSimulatorProps) {
  const subjectHasSlots = slots.some((slot) => slot.subject_id === subject.id);

  const [prevSubjectId, setPrevSubjectId] = useState(subject.id);
  const [upcoming, setUpcoming] = useState(
    () => getInitialUpcoming(subject.id, slots).upcoming
  );
  const [skip, setSkip] = useState(0);

  if (prevSubjectId !== subject.id) {
    setPrevSubjectId(subject.id);
    setUpcoming(getInitialUpcoming(subject.id, slots).upcoming);
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
  const projectedTone = levelToTone(projectedLevel);

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
      verdictText = `Stays at or above ${target}%. You could still skip ${remainingSkips} more after this.`;
    } else {
      const needed = mustAttend(projected.attended, projected.held, target);
      verdictText = `Drops below ${target}%. Attend the next ${needed} ${pluralizeClasses(needed)} in a row to get back to ${target}%.`;
    }
  }

  const fillWidthPercent =
    projectedRatio === null ? 0 : Math.min(100, Math.max(0, projectedRatio));

  return (
    <Card style={styles.card}>
      <AppText variant="heading">What-if simulator</AppText>

      <View style={styles.controlsGroup}>
        <Stepper
          label="Upcoming classes"
          value={upcoming}
          min={0}
          max={MAX_UPCOMING}
          onChange={handleUpcomingChange}
        />

        {!subjectHasSlots ? (
          <AppText variant="caption" tone="muted">
            Add this subject to your timetable to prefill this.
          </AppText>
        ) : null}

        <Stepper
          label="Classes you skip"
          value={safeSkip}
          min={0}
          max={upcoming}
          onChange={setSkip}
        />

        <View style={styles.quickButtonsRow}>
          <View style={styles.quickButtonWrapper}>
            <Button
              title="Skip none"
              variant="secondary"
              onPress={() => setSkip(0)}
              disabled={safeSkip === 0}
              fullWidth
            />
          </View>
          <View style={styles.quickButtonWrapper}>
            <Button
              title="Skip all"
              variant="secondary"
              onPress={() => setSkip(upcoming)}
              disabled={upcoming === 0 || safeSkip === upcoming}
              fullWidth
            />
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      {!hasProjectedData ? (
        <View style={styles.resultSection}>
          <View style={styles.resultHeaderRow}>
            <AppText variant="title" tone="muted">
              No data
            </AppText>
            <LevelBadge level="no_data" />
          </View>
        </View>
      ) : (
        <View style={styles.resultSection}>
          <View style={styles.resultHeaderRow}>
            <View style={styles.percentRow}>
              <AppText variant="title" style={styles.projectedPercent}>
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
                        ? 'safe'
                        : 'muted'
                  }
                  style={styles.deltaText}
                >
                  {deltaText}
                </AppText>
              ) : null}
            </View>
            <LevelBadge level={projectedLevel} />
          </View>

          <View
            accessible
            accessibilityLabel={`Projected attendance ${projectedPercentText}, target ${target} percent`}
            style={styles.barContainer}
          >
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${fillWidthPercent}%`,
                    backgroundColor: barFillColorMap[projectedTone],
                  },
                ]}
              />
            </View>
            <View
              pointerEvents="none"
              style={[styles.targetMarker, { left: `${target}%` }]}
            />
          </View>

          <AppText variant="caption" tone="muted">
            Target {target}%
          </AppText>

          {verdictText ? (
            <AppText variant="body" style={styles.verdictText}>
              {verdictText}
            </AppText>
          ) : null}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.lg,
  },
  controlsGroup: {
    gap: spacing.md,
  },
  quickButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  quickButtonWrapper: {
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  resultSection: {
    gap: spacing.sm,
  },
  resultHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  percentRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    flexWrap: 'wrap',
    flex: 1,
  },
  projectedPercent: {
    fontVariant: ['tabular-nums'],
  },
  deltaText: {
    fontVariant: ['tabular-nums'],
  },
  barContainer: {
    height: 20,
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  barTrack: {
    height: 10,
    borderRadius: radius.small,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: radius.small,
  },
  targetMarker: {
    position: 'absolute',
    top: 1,
    bottom: 1,
    width: 2,
    marginLeft: -1,
    backgroundColor: colors.text,
    borderRadius: 1,
  },
  verdictText: {
    marginTop: spacing.xs,
  },
});
