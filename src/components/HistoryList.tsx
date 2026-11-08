import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { PressableScale } from '@/components/ui/PressableScale';
import {
  formatFriendlyDateLabel,
  formatMonthYear,
  formatTime12Hour,
  getMonthKey,
} from '@/lib/dates';
import { colors, radius, spacing } from '@/theme/tokens';
import {
  type AttendanceLog,
  type AttendanceStatus,
  type TimetableSlot,
} from '@/types/db';

export interface HistoryListProps {
  logs: readonly AttendanceLog[];
  slots: readonly TimetableSlot[];
}

interface MonthGroup {
  key: string;
  label: string;
  items: AttendanceLog[];
}

const STATUS_META: Record<
  AttendanceStatus,
  { label: string; dotColor: string; tone: 'safe' | 'danger' | 'muted' }
> = {
  present: { label: 'Present', dotColor: colors.safe, tone: 'safe' },
  absent: { label: 'Absent', dotColor: colors.danger, tone: 'danger' },
  cancelled: { label: 'Cancelled', dotColor: colors.textMuted, tone: 'muted' },
};

function formatSlotTime(slot: TimetableSlot): string {
  const start = formatTime12Hour(slot.start_time);
  if (!slot.end_time) {
    return start;
  }
  return `${start} to ${formatTime12Hour(slot.end_time)}`;
}

export function HistoryList({ logs, slots }: HistoryListProps) {
  const slotById = useMemo(() => {
    const map: Record<string, TimetableSlot> = {};
    for (const slot of slots) {
      map[slot.id] = slot;
    }
    return map;
  }, [slots]);

  const groups = useMemo<MonthGroup[]>(() => {
    const sorted = [...logs].sort((a, b) => {
      const dateDiff = b.log_date.localeCompare(a.log_date);
      if (dateDiff !== 0) {
        return dateDiff;
      }
      return b.created_at.localeCompare(a.created_at);
    });

    const map = new Map<string, MonthGroup>();
    for (const log of sorted) {
      const key = getMonthKey(log.log_date);
      const existing = map.get(key);
      if (existing) {
        existing.items.push(log);
      } else {
        map.set(key, {
          key,
          label: formatMonthYear(log.log_date),
          items: [log],
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [logs]);

  const openDateInToday = (dateStr: string) => {
    router.navigate({
      pathname: '/(tabs)/today',
      params: { date: dateStr },
    });
  };

  return (
    <View style={styles.wrapper}>
      <Card style={styles.card}>
        <AppText variant="heading">History</AppText>

        {groups.length === 0 ? (
          <AppText variant="body" tone="muted">
            No attendance entries yet.
          </AppText>
        ) : (
          <View style={styles.groupList}>
            {groups.map((group) => (
              <View key={group.key} style={styles.monthSection}>
                <AppText variant="label" tone="muted">
                  {group.label}
                </AppText>

                <View style={styles.rowList}>
                  {group.items.map((log) => {
                    const statusInfo = STATUS_META[log.status];
                    const slot = log.slot_id ? slotById[log.slot_id] : undefined;
                    const dateLabel = formatFriendlyDateLabel(log.log_date);
                    const timeLabel = slot ? formatSlotTime(slot) : null;
                    const accessibilityLabel = timeLabel
                      ? `${dateLabel}, ${timeLabel}, ${statusInfo.label}. Open in Today.`
                      : `${dateLabel}, ${statusInfo.label}. Open in Today.`;

                    return (
                      <PressableScale
                        key={log.id}
                        onPress={() => openDateInToday(log.log_date)}
                        scaleTo={0.985}
                        rippleColor={colors.rippleNeutral}
                        accessibilityRole="button"
                        accessibilityLabel={accessibilityLabel}
                        containerStyle={styles.rowContainer}
                        style={({ pressed }) => [
                          styles.row,
                          pressed && styles.rowPressed,
                        ]}
                      >
                        <View style={styles.leftColumn}>
                          <AppText variant="body" numberOfLines={1}>
                            {dateLabel}
                          </AppText>
                          {timeLabel ? (
                            <AppText
                              variant="caption"
                              tone="muted"
                              numberOfLines={1}
                            >
                              {timeLabel}
                            </AppText>
                          ) : null}
                        </View>

                        <View style={styles.rightColumn}>
                          <View style={styles.statusBadge}>
                            <View
                              style={[
                                styles.statusDot,
                                { backgroundColor: statusInfo.dotColor },
                              ]}
                            />
                            <AppText
                              variant="label"
                              tone={statusInfo.tone}
                              numberOfLines={1}
                            >
                              {statusInfo.label}
                            </AppText>
                          </View>
                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color={colors.textMuted}
                          />
                        </View>
                      </PressableScale>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>

      <AppText variant="caption" tone="muted" style={styles.footerNote}>
        To change an entry, open its date in Today.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  card: {
    gap: spacing.md,
  },
  groupList: {
    gap: spacing.lg,
  },
  monthSection: {
    gap: spacing.sm,
  },
  rowList: {
    gap: spacing.xs,
  },
  rowContainer: {
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMutedPressed,
  },
  leftColumn: {
    flex: 1,
    gap: 2,
  },
  rightColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  footerNote: {
    textAlign: 'center',
  },
});
