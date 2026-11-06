import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { LevelBadge } from '@/components/ui/LevelBadge';
import { PressableScale } from '@/components/ui/PressableScale';
import {
  canSkip,
  clampTarget,
  formatDisplayPercent,
  getAttendanceLevel,
  levelToTone,
  meetsTarget,
  mustAttend,
  type AttendanceCounts,
} from '@/lib/attendance';
import { formatTime12Hour, timeStringToMinutes } from '@/lib/dates';
import { colors, radius, spacing } from '@/theme/tokens';
import {
  type AttendanceStatus,
  type Subject,
  type TimetableSlot,
} from '@/types/db';

export interface TodayClassCardProps {
  slot: TimetableSlot;
  subject: Subject;
  counts: AttendanceCounts;
  status: AttendanceStatus | null;
  pending: boolean;
  onSelectStatus: (nextStatus: AttendanceStatus) => void;
}

interface StatusOption {
  value: AttendanceStatus;
  label: string;
  activeIcon: keyof typeof Ionicons.glyphMap;
  inactiveIcon: keyof typeof Ionicons.glyphMap;
  activeBg: string;
  activeBorder: string;
  activeTextColor: string;
  activeIconColor: string;
}

const STATUS_OPTIONS: readonly StatusOption[] = [
  {
    value: 'present',
    label: 'Present',
    activeIcon: 'checkmark-circle',
    inactiveIcon: 'checkmark-circle-outline',
    activeBg: colors.safe,
    activeBorder: colors.safe,
    activeTextColor: colors.onAccent,
    activeIconColor: colors.onAccent,
  },
  {
    value: 'absent',
    label: 'Absent',
    activeIcon: 'close-circle',
    inactiveIcon: 'close-circle-outline',
    activeBg: colors.danger,
    activeBorder: colors.danger,
    activeTextColor: colors.onAccent,
    activeIconColor: colors.onAccent,
  },
  {
    value: 'cancelled',
    label: 'Cancelled',
    activeIcon: 'remove-circle',
    inactiveIcon: 'remove-circle-outline',
    activeBg: colors.text,
    activeBorder: colors.text,
    activeTextColor: colors.onAccent,
    activeIconColor: colors.onAccent,
  },
];

function getSubjectInitials(name: string): string {
  const clean = name.trim();
  if (!clean) return 'SB';
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

function formatSlotTimeRange(slot: TimetableSlot): string {
  const start = formatTime12Hour(slot.start_time);
  if (!slot.end_time) {
    return start;
  }
  return `${start} to ${formatTime12Hour(slot.end_time)}`;
}

function formatSlotDuration(startStr: string, endStr: string | null): string | null {
  if (!endStr) return null;
  try {
    const startMins = timeStringToMinutes(startStr);
    const endMins = timeStringToMinutes(endStr);
    const diff = endMins - startMins;
    if (diff <= 0) return null;
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

export function TodayClassCard({
  slot,
  subject,
  counts,
  status,
  pending,
  onSelectStatus,
}: TodayClassCardProps) {
  const timeRange = formatSlotTimeRange(slot);
  const duration = formatSlotDuration(slot.start_time, slot.end_time);
  const percentText = formatDisplayPercent(counts.attended, counts.held);
  const target = clampTarget(subject.target_percent);
  const level = getAttendanceLevel(counts.attended, counts.held, target);
  const tone = levelToTone(level);

  const canBunk = canSkip(counts.attended, counts.held, target);
  const needed = mustAttend(counts.attended, counts.held, target);
  const targetMet = meetsTarget(counts.attended, counts.held, target);

  let bufferText = 'No recorded classes yet';
  let bufferToneColor: string = colors.textMuted;
  if (counts.held > 0) {
    if (!targetMet) {
      bufferText = `Need next ${needed} ${needed === 1 ? 'class' : 'classes'} for ${target}%`;
      bufferToneColor = colors.danger;
    } else if (canBunk === 0) {
      bufferText = `On margin (${target}%) • Zero skip margin`;
      bufferToneColor = colors.warn;
    } else {
      bufferText = `Safe margin: ${canBunk} ${canBunk === 1 ? 'skip' : 'skips'} buffer`;
      bufferToneColor = colors.safe;
    }
  }

  const avatarBg =
    tone === 'safe'
      ? colors.safeBg
      : tone === 'danger'
        ? colors.dangerBg
        : tone === 'warn'
          ? colors.warnBg
          : colors.surfaceMuted;

  const avatarColor =
    tone === 'safe'
      ? colors.safe
      : tone === 'danger'
        ? colors.danger
        : tone === 'warn'
          ? colors.warn
          : colors.textMuted;

  return (
    <Card style={styles.card}>
      {/* Top Header: Avatar, Name, Time, Percentage */}
      <View style={styles.headerRow}>
        <View style={[styles.avatarBox, { backgroundColor: avatarBg }]}>
          <AppText variant="label" style={[styles.avatarText, { color: avatarColor }]}>
            {getSubjectInitials(subject.name)}
          </AppText>
        </View>

        <View style={styles.subjectInfo}>
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={12} color={colors.textMuted} />
            <AppText variant="caption" tone="muted" style={styles.timeText}>
              {timeRange}
            </AppText>
            {duration && (
              <View style={styles.durationChip}>
                <AppText variant="caption" style={styles.durationChipText}>
                  {duration}
                </AppText>
              </View>
            )}
          </View>

          <AppText variant="heading" numberOfLines={1} style={styles.subjectName}>
            {subject.name}
          </AppText>
        </View>

        <View style={styles.statColumn}>
          <AppText variant="heading" style={[styles.percentText, { color: avatarColor }]}>
            {percentText}
          </AppText>
          <LevelBadge level={level} />
        </View>
      </View>

      {/* Attendance Buffer Insight Strip */}
      <View style={styles.insightStrip}>
        <AppText variant="caption" style={[styles.insightText, { color: bufferToneColor }]}>
          {bufferText}
        </AppText>
        <AppText variant="caption" tone="muted" style={styles.recordRatio}>
          {counts.attended}/{counts.held} attended
        </AppText>
      </View>

      {/* Attendance Status Selector Buttons */}
      <View style={styles.controlsRow}>
        {STATUS_OPTIONS.map((option) => {
          const selected = status === option.value;
          return (
            <PressableScale
              key={option.value}
              onPress={() => onSelectStatus(option.value)}
              disabled={pending}
              scaleTo={0.96}
              rippleColor={
                selected ? colors.rippleOnAccent : colors.rippleNeutral
              }
              accessibilityRole="button"
              accessibilityLabel={`${option.label} for ${subject.name}`}
              accessibilityState={{ selected, disabled: pending, busy: pending }}
              containerStyle={[
                styles.statusButtonContainer,
                selected && {
                  backgroundColor: option.activeBg,
                  borderColor: option.activeBorder,
                },
                pending && styles.statusButtonPending,
              ]}
              style={styles.statusButton}
            >
              <Ionicons
                name={selected ? option.activeIcon : option.inactiveIcon}
                size={16}
                color={selected ? option.activeIconColor : colors.textMuted}
                style={styles.btnIcon}
              />
              <AppText
                variant="label"
                style={[
                  styles.btnLabel,
                  selected
                    ? { color: option.activeTextColor, fontWeight: '700' }
                    : { color: colors.text },
                ]}
                numberOfLines={1}
              >
                {option.label}
              </AppText>
            </PressableScale>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontWeight: '700',
    fontSize: 15,
  },
  subjectInfo: {
    flex: 1,
    gap: 2,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  durationChip: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 2,
  },
  durationChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  statColumn: {
    alignItems: 'flex-end',
    gap: 3,
  },
  percentText: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  insightStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.control,
  },
  insightText: {
    fontWeight: '600',
    fontSize: 11,
    flex: 1,
  },
  recordRatio: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    marginLeft: spacing.xs,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statusButtonContainer: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  statusButton: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    gap: 5,
  },
  btnIcon: {
    marginTop: 0,
  },
  btnLabel: {
    fontSize: 13,
  },
  statusButtonPending: {
    opacity: 0.55,
  },
});
