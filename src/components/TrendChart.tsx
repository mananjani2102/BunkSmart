import { memo, useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import {
  clampTarget,
  formatDisplayPercent,
  formatPercentSpoken,
} from '@/lib/attendance';
import { useTheme } from '@/theme/ThemeProvider';
import { fontFamily, spacing } from '@/theme/tokens';
import { type AttendanceLog } from '@/types/db';

export interface TrendChartProps {
  target: number;
  pointCount: number;
  percentSeries: string;
  firstDisplay: string;
  lastDisplay: string;
  firstSpoken: string;
  lastSpoken: string;
}

const CHART_HEIGHT = 168;
const PAD_LEFT = 40;
const PAD_RIGHT = 12;
const PAD_TOP = 14;
const PAD_BOTTOM = 14;
const GRID_VALUES = [100, 50, 0] as const;

export function buildTrendChartProps(
  initialPresent: number,
  initialTotal: number,
  targetPercent: number,
  logs: readonly AttendanceLog[]
): TrendChartProps {
  const target = clampTarget(targetPercent);
  const ordered = [...logs].sort((a, b) => {
    const dateDiff = a.log_date.localeCompare(b.log_date);
    if (dateDiff !== 0) {
      return dateDiff;
    }
    return a.created_at.localeCompare(b.created_at);
  });

  let attended = Math.max(0, initialPresent);
  let held = Math.max(0, initialTotal);
  const percents: number[] = [];
  let firstDisplay = '--';
  let lastDisplay = '--';
  let firstSpoken = '';
  let lastSpoken = '';

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
      const percent = Math.min(100, Math.max(0, (attended * 100) / held));
      percents.push(percent);
      const display = formatDisplayPercent(attended, held);
      const spoken = formatPercentSpoken(attended, held);
      if (percents.length === 1) {
        firstDisplay = display;
        firstSpoken = spoken;
      }
      lastDisplay = display;
      lastSpoken = spoken;
    }
  }

  return {
    target,
    pointCount: percents.length,
    percentSeries: percents.map((value) => value.toFixed(4)).join(','),
    firstDisplay,
    lastDisplay,
    firstSpoken,
    lastSpoken,
  };
}

export const TrendChart = memo(function TrendChart({
  target,
  pointCount,
  percentSeries,
  firstDisplay,
  lastDisplay,
  firstSpoken,
  lastSpoken,
}: TrendChartProps) {
  const { colors } = useTheme();
  const [chartWidth, setChartWidth] = useState(280);

  const percents = useMemo(() => {
    if (!percentSeries) {
      return [];
    }
    return percentSeries.split(',').map((raw) => Number(raw));
  }, [percentSeries]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.floor(event.nativeEvent.layout.width);
    if (nextWidth > 0) {
      setChartWidth((prev) => (prev === nextWidth ? prev : nextWidth));
    }
  }, []);

  if (pointCount < 2 || percents.length < 2) {
    return (
      <Card style={styles.card}>
        <AppText variant="heading">Trend</AppText>
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
    PAD_LEFT + (index / (percents.length - 1)) * plotWidth;

  const coords = percents.map((percent, index) => ({
    x: xForIndex(index),
    y: yForPercent(percent),
  }));

  const polylinePoints = coords
    .map((coord) => `${coord.x.toFixed(1)},${coord.y.toFixed(1)}`)
    .join(' ');

  const lastCoord = coords[coords.length - 1];
  const targetY = yForPercent(target);
  const targetLabelY = target > 88 ? targetY + 13 : targetY - 5;

  return (
    <Card style={styles.card}>
      <AppText variant="heading">Trend</AppText>

      <View
        onLayout={handleLayout}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Trend from ${firstSpoken} to ${lastSpoken}, target ${target} percent`}
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
                fill={colors.mutedForeground}
                fontFamily={fontFamily.regular}
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
            stroke={colors.mutedForeground}
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />

          <SvgText
            x={chartWidth - PAD_RIGHT}
            y={targetLabelY}
            fill={colors.mutedForeground}
            fontFamily={fontFamily.medium}
            fontSize={11}
            textAnchor="end"
          >
            {target}%
          </SvgText>

          <Polyline
            points={polylinePoints}
            fill="none"
            stroke={colors.foreground}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <Circle
            cx={lastCoord.x}
            cy={lastCoord.y}
            r={5}
            fill={colors.foreground}
            stroke={colors.card}
            strokeWidth={2}
          />
        </Svg>
      </View>

      <View style={styles.footerRow}>
        <AppText variant="caption" tone="muted" style={styles.tabular}>
          First: {firstDisplay}
        </AppText>
        <AppText variant="caption" tone="muted" style={styles.tabular}>
          Latest: {lastDisplay}
        </AppText>
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
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
