import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo, useCallback, useMemo } from 'react';
import { View } from 'react-native';

import { AppText, type AppTextTone } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { PressableScale } from '@/components/ui/PressableScale';
import {
  formatFriendlyDateLabel,
  formatMonthYear,
  formatTime12Hour,
  getMonthKey,
} from '@/lib/dates';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, type ThemeColors } from '@/theme/tokens';
import {
  type AttendanceLog,
  type AttendanceStatus,
  type TimetableSlot,
} from '@/types/db';

export type HistoryRowItem =
  | {
      type: 'header';
      key: string;
      label: string;
      isFirst: boolean;
    }
  | {
      type: 'entry';
      key: string;
      logId: string;
      logDate: string;
      status: AttendanceStatus;
      timeLabel: string | null;
      isLastInGroup: boolean;
    };

export const EMPTY_HISTORY_ITEMS: readonly HistoryRowItem[] = [];

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  emptyCard: {
    gap: spacing.md,
  },
  cardTopCap: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  cardSlice: {
    backgroundColor: colors.card,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  monthHeaderFirst: {
    paddingTop: 0,
    paddingBottom: spacing.sm,
  },
  monthHeaderNext: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  entryWithGap: {
    paddingBottom: spacing.xs,
  },
  entryLastInGroup: {
    paddingBottom: 0,
  },
  cardBottomCap: {
    backgroundColor: colors.card,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: radius.card,
    borderBottomRightRadius: radius.card,
    height: spacing.lg,
  },
  footerWithItems: {
    gap: spacing.sm,
  },
  footerEmpty: {
    marginTop: spacing.sm,
  },
  rowContainer: {
    borderRadius: radius.control,
    backgroundColor: colors.muted,
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
    backgroundColor: colors.secondary,
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
    borderRadius: radius.dot,
  },
  footerNote: {
    textAlign: 'center',
  },
}));

function getStatusVisual(
  status: AttendanceStatus,
  colors: ThemeColors
): { label: string; dotColor: string; tone: AppTextTone } {
  switch (status) {
    case 'present':
      return { label: 'Present', dotColor: colors.success, tone: 'success' };
    case 'absent':
      return { label: 'Absent', dotColor: colors.destructive, tone: 'danger' };
    case 'cancelled':
    default:
      return {
        label: 'Cancelled',
        dotColor: colors.mutedForeground,
        tone: 'muted',
      };
  }
}

function formatSlotTime(slot: TimetableSlot): string {
  const start = formatTime12Hour(slot.start_time);
  if (!slot.end_time) {
    return start;
  }
  return `${start} to ${formatTime12Hour(slot.end_time)}`;
}

export function buildHistoryItems(
  logs: readonly AttendanceLog[],
  slots: readonly TimetableSlot[]
): HistoryRowItem[] {
  if (logs.length === 0) {
    return [];
  }

  const slotById: Record<string, TimetableSlot> = {};
  for (const slot of slots) {
    slotById[slot.id] = slot;
  }

  const sorted = [...logs].sort((a, b) => {
    const dateDiff = b.log_date.localeCompare(a.log_date);
    if (dateDiff !== 0) {
      return dateDiff;
    }
    return b.created_at.localeCompare(a.created_at);
  });

  const groupMap = new Map<
    string,
    { key: string; label: string; items: AttendanceLog[] }
  >();
  for (const log of sorted) {
    const key = getMonthKey(log.log_date);
    const existing = groupMap.get(key);
    if (existing) {
      existing.items.push(log);
    } else {
      groupMap.set(key, {
        key,
        label: formatMonthYear(log.log_date),
        items: [log],
      });
    }
  }

  const orderedGroups = Array.from(groupMap.values()).sort((a, b) =>
    b.key.localeCompare(a.key)
  );

  const flat: HistoryRowItem[] = [];
  orderedGroups.forEach((group, groupIndex) => {
    flat.push({
      type: 'header',
      key: `month-${group.key}`,
      label: group.label,
      isFirst: groupIndex === 0,
    });

    const lastIdx = group.items.length - 1;
    group.items.forEach((log, rowIndex) => {
      const slot = log.slot_id ? slotById[log.slot_id] : undefined;
      flat.push({
        type: 'entry',
        key: log.id,
        logId: log.id,
        logDate: log.log_date,
        status: log.status,
        timeLabel: slot ? formatSlotTime(slot) : null,
        isLastInGroup: rowIndex === lastIdx,
      });
    });
  });

  return flat;
}

export const HistoryCardTop = memo(function HistoryCardTop({
  isEmpty,
}: {
  isEmpty: boolean;
}) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);

  if (isEmpty) {
    return (
      <Card style={styles.emptyCard}>
        <AppText variant="heading">History</AppText>
        <AppText variant="body" tone="muted">
          No attendance entries yet.
        </AppText>
      </Card>
    );
  }

  return (
    <View style={styles.cardTopCap}>
      <AppText variant="heading">History</AppText>
    </View>
  );
});

export const HistoryCardFooter = memo(function HistoryCardFooter({
  hasItems,
}: {
  hasItems: boolean;
}) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);

  return (
    <View style={hasItems ? styles.footerWithItems : styles.footerEmpty}>
      {hasItems ? <View style={styles.cardBottomCap} /> : null}
      <AppText variant="caption" tone="muted" style={styles.footerNote}>
        To change an entry, open its date in Today.
      </AppText>
    </View>
  );
});

interface HistorySectionRowProps {
  item: HistoryRowItem;
  onPressDate: (dateStr: string) => void;
}

export const HistorySectionRow = memo(function HistorySectionRow({
  item,
  onPressDate,
}: HistorySectionRowProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);

  const handlePress = useCallback(() => {
    if (item.type === 'entry') {
      onPressDate(item.logDate);
    }
  }, [item, onPressDate]);

  if (item.type === 'header') {
    return (
      <View
        style={[
          styles.cardSlice,
          item.isFirst ? styles.monthHeaderFirst : styles.monthHeaderNext,
        ]}
      >
        <AppText variant="label" tone="muted">
          {item.label}
        </AppText>
      </View>
    );
  }

  const statusInfo = getStatusVisual(item.status, colors);
  const dateLabel = formatFriendlyDateLabel(item.logDate);
  const accessibilityLabel = item.timeLabel
    ? `${dateLabel}, ${item.timeLabel}, ${statusInfo.label}. Open in Today.`
    : `${dateLabel}, ${statusInfo.label}. Open in Today.`;

  return (
    <View
      style={[
        styles.cardSlice,
        item.isLastInGroup ? styles.entryLastInGroup : styles.entryWithGap,
      ]}
    >
      <PressableScale
        onPress={handlePress}
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
          {item.timeLabel ? (
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {item.timeLabel}
            </AppText>
          ) : null}
        </View>

        <View style={styles.rightColumn}>
          <View style={styles.statusBadge}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no"
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
            color={colors.mutedForeground}
          />
        </View>
      </PressableScale>
    </View>
  );
});

export interface HistoryListProps {
  logs: readonly AttendanceLog[];
  slots: readonly TimetableSlot[];
}

/**
 * Standalone non-virtualized history view kept for callers rendering small bounded sets.
 */
export function HistoryList({ logs, slots }: HistoryListProps) {
  const items = useMemo(() => buildHistoryItems(logs, slots), [logs, slots]);
  const openDateInToday = useCallback((dateStr: string) => {
    router.navigate({
      pathname: '/(tabs)/today',
      params: { date: dateStr },
    });
  }, []);

  return (
    <View>
      <HistoryCardTop isEmpty={items.length === 0} />
      {items.map((item) => (
        <HistorySectionRow
          key={item.key}
          item={item}
          onPressDate={openDateInToday}
        />
      ))}
      <HistoryCardFooter hasItems={items.length > 0} />
    </View>
  );
}
