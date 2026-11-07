import { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import {
  clampTarget,
  formatDisplayPercent,
  formatPercentSpoken,
} from '@/lib/attendance';
import { colors, spacing } from '@/theme/tokens';
import { type AttendanceLog, type Subject } from '@/types/db';

export interface TrendChartProps {
  subject: Subject;
  logs: readonly AttendanceLog[];
}

interface TrendPoint {
  percent: number;
  displayPercent: string;
  spokenPercent: string;
}

const CHART_HEIGHT = 168;
const PAD_LEFT = 40;
const PAD_RIGHT = 12;
const PAD_TOP = 14;
const PAD_BOTTOM = 14;
const GRID_VALUES = [100, 50, 0] as const;

function buildTrendPoints(
  subject: Subject,
  logs: readonly AttendanceLog[]
): TrendPoint[] {
  const ordered = [...logs].sort((a, b) => {
    const dateDiff = a.log_date.localeCompare(b.log_date);
    if (dateDiff !== 0) {
      return dateDiff;
    }
    return a.created_at.localeCompare(b.created_at);
  });

  let attended = Math.max(0, subject.initial_present);
  let held = Math.max(0, subject.initial_total);
  const points: TrendPoint[] = [];

  for (const log of ordered) {
    if (log.status === 'cancelled') {
      continue;
    }
    if (log.status === 'present') {
      attended += 1;
      held += 1;
    } else if (log.status === 'absent') {
      held += 1;
    }

    if (held > 0) {
      points.push({
        percent: Math.min(100, Math.max(0, (attended * 100) / held)),
        displayPercent: formatDisplayPercent(attended, held),
        spokenPercent: formatPercentSpoken(attended, held),
      });
    }
  }

  return points;
}

export function TrendChart({ subject, logs }: TrendChartProps) {
  const [chartWidth, setChartWidth] = useState(280);

  const points = useMemo(() => buildTrendPoints(subject, logs), [subject, logs]);
  const target = clampTarget(subject.target_percent);

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.floor(event.nativeEvent.layout.width);
    if (nextWidth > 0 && nextWidth !== chartWidth) {
      setChartWidth(nextWidth);
    }
  };

  if (points.length < 2) {
    return (
      <Card style={styles.card}>
        <AppText variant="heading">Attendance trend</AppText>
        <AppText variant="body" tone="muted">
          Mark a few classes to see the trend.
        </AppText>
      </Card>
    );
  }

  const plotWidth = Math.max(40, chartWidth - PAD_LEFT - PAD_RIGHT);
  const plotHeight = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

  const yForPercent = (percent: number): number =>
    PAD_TOP + ((100 - percent) / 100) * plotHeight;

  const xForIndex = (index: number): number =>
    PAD_LEFT + (index / (points.length - 1)) * plotWidth;

  const coords = points.map((point, index) => ({
    x: xForIndex(index),
    y: yForPercent(point.percent),
  }));

  const polylinePoints = coords
    .map((coord) => `${coord.x.toFixed(1)},${coord.y.toFixed(1)}`)
    .join(' ');

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const lastCoord = coords[coords.length - 1];
  const targetY = yForPercent(target);

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <AppText variant="heading">Attendance trend</AppText>
        <AppText variant="caption" tone="muted" style={styles.targetCaption}>
          Target {target}%
        </AppText>
      </View>

      <View
        onLayout={handleLayout}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Attendance trend from ${firstPoint.spokenPercent} to ${lastPoint.spokenPercent}, target ${target} percent`}
        style={styles.chartWrapper}
      >
        <Svg width={chartWidth} height={CHART_HEIGHT}>
          {GRID_VALUES.map((gridValue) => {
            const y = yForPercent(gridValue);
            return (
              <Line
                key={`grid-${gridValue}`}
                x1={PAD_LEFT}
                y1={y}
                x2={chartWidth - PAD_RIGHT}
                y2={y}
                stroke={colors.border}
                strokeWidth={1}
              />
            );
          })}

          {GRID_VALUES.map((gridValue) => {
            const y = yForPercent(gridValue);
            return (
              <SvgText
                key={`label-${gridValue}`}
                x={PAD_LEFT - 6}
                y={y + 4}
                fill={colors.textMuted}
                fontSize={11}
                textAnchor="end"
              >
                {gridValue}%
              </SvgText>
            );
          })}

          <Line
            x1={PAD_LEFT}
            y1={targetY}
            x2={chartWidth - PAD_RIGHT}
            y2={targetY}
            stroke={colors.textMuted}
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />

          <Polyline
            points={polylinePoints}
            fill="none"
            stroke={colors.accent}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <Circle
            cx={lastCoord.x}
            cy={lastCoord.y}
            r={5}
            fill={colors.accent}
            stroke={colors.surface}
            strokeWidth={2}
          />
        </Svg>
      </View>

      <View style={styles.footerRow}>
        <AppText variant="caption" tone="muted" style={styles.tabular}>
          First: {firstPoint.displayPercent}
        </AppText>
        <AppText variant="caption" tone="muted" style={styles.tabular}>
          Latest: {lastPoint.displayPercent}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  targetCaption: {
    fontVariant: ['tabular-nums'],
  },
  chartWrapper: {
    width: '100%',
    height: CHART_HEIGHT,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
