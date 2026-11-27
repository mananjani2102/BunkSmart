import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { spacing, type ThemeColors } from '@/theme/tokens';

export interface TodaySummaryBarProps {
  markedCount: number;
  totalCount: number;
  presentCount: number;
  absentCount: number;
  cancelledCount: number;
}

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  container: {
    gap: spacing.xs + 2,
  },
  labelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  countsText: {
    flexShrink: 1,
    fontVariant: ['tabular-nums'],
  },
  barTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.muted,
    flexDirection: 'row',
    overflow: 'hidden',
    gap: 2,
  },
  segment: {
    height: '100%',
  },
}));

export function TodaySummaryBar({
  markedCount,
  totalCount,
  presentCount,
  absentCount,
  cancelledCount,
}: TodaySummaryBarProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const remainingCount = Math.max(0, totalCount - markedCount);

  const countsParts = [`${presentCount} present`, `${absentCount} absent`];
  if (cancelledCount > 0) {
    countsParts.push(`${cancelledCount} cancelled`);
  }

  const summaryLabel = `${markedCount} of ${totalCount} classes marked. ${countsParts.join(', ')}`;

  return (
    <View
      accessible
      accessibilityLabel={summaryLabel}
      style={styles.container}
    >
      <View style={styles.labelRow}>
        <AppText variant="label">
          {markedCount} of {totalCount} marked
        </AppText>
        <AppText
          variant="caption"
          tone="muted"
          style={styles.countsText}
        >
          {countsParts.join(', ')}
        </AppText>
      </View>

      <View style={styles.barTrack}>
        {presentCount > 0 ? (
          <View
            style={[
              styles.segment,
              { flex: presentCount, backgroundColor: colors.success },
            ]}
          />
        ) : null}
        {absentCount > 0 ? (
          <View
            style={[
              styles.segment,
              { flex: absentCount, backgroundColor: colors.destructive },
            ]}
          />
        ) : null}
        {cancelledCount > 0 ? (
          <View
            style={[
              styles.segment,
              { flex: cancelledCount, backgroundColor: colors.mutedForeground },
            ]}
          />
        ) : null}
        {remainingCount > 0 ? (
          <View
            style={[
              styles.segment,
              { flex: remainingCount, backgroundColor: colors.muted },
            ]}
          />
        ) : null}
      </View>
    </View>
  );
}
