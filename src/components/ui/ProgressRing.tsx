import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { AppText } from '@/components/ui/AppText';
import { clampTarget, type AttendanceTone } from '@/lib/attendance';
import { useTheme } from '@/theme/ThemeProvider';
import { fontFamily, type ThemeColors } from '@/theme/tokens';

export interface ProgressRingProps {
  value: number | null;
  target: number;
  size: number;
  strokeWidth?: number;
  tone: AttendanceTone;
  label: string;
  accessibilityLabel: string;
}

function getProgressStrokeColor(
  tone: AttendanceTone,
  colors: ThemeColors
): string {
  switch (tone) {
    case 'safe':
      return colors.success;
    case 'warn':
      return colors.amber;
    case 'danger':
      return colors.destructive;
    case 'muted':
    default:
      return colors.mutedForeground;
  }
}

function getLabelFontSize(size: number, isNoData: boolean): number {
  if (size >= 130) {
    return isNoData ? 16 : 24;
  }
  if (size >= 96) {
    return isNoData ? 13 : 18;
  }
  return isNoData ? 11 : 14;
}

/**
 * Memoized circular progress gauge driven strictly by primitive props.
 */
export const ProgressRing = memo(function ProgressRing({
  value,
  target,
  size,
  strokeWidth,
  tone,
  label,
  accessibilityLabel,
}: ProgressRingProps) {
  const { colors } = useTheme();
  const resolvedStrokeWidth =
    strokeWidth ?? Math.max(6, Math.round(size * 0.09));

  const geometry = useMemo(() => {
    const tickOverhang = 3;
    const center = size / 2;
    const ringRadius = Math.max(
      4,
      (size - resolvedStrokeWidth) / 2 - tickOverhang
    );
    const circumference = 2 * Math.PI * ringRadius;

    const clampedValue =
      value === null ? null : Math.min(100, Math.max(0, value));
    const showProgress = clampedValue !== null && clampedValue > 0;
    const dashOffset =
      clampedValue === null
        ? circumference
        : circumference * (1 - clampedValue / 100);

    const clampedTarget = clampTarget(target);
    const targetAngle = ((clampedTarget / 100) * 360 - 90) * (Math.PI / 180);
    const tickInner = ringRadius - resolvedStrokeWidth / 2 - 2;
    const tickOuter = ringRadius + resolvedStrokeWidth / 2 + 2;
    const x1 = center + tickInner * Math.cos(targetAngle);
    const y1 = center + tickInner * Math.sin(targetAngle);
    const x2 = center + tickOuter * Math.cos(targetAngle);
    const y2 = center + tickOuter * Math.sin(targetAngle);

    const fontSize = getLabelFontSize(size, value === null);

    return {
      center,
      ringRadius,
      circumference,
      showProgress,
      dashOffset,
      x1,
      y1,
      x2,
      y2,
      containerStyle: { width: size, height: size },
      labelStyle: {
        fontSize,
        lineHeight: fontSize + 4,
        maxWidth: size - resolvedStrokeWidth * 2 - 12,
      },
      dashArray: `${circumference} ${circumference}`,
      rotateTransform: `rotate(-90 ${center} ${center})`,
    };
  }, [resolvedStrokeWidth, size, target, value]);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[styles.container, geometry.containerStyle]}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={geometry.center}
          cy={geometry.center}
          r={geometry.ringRadius}
          stroke={colors.border}
          strokeWidth={resolvedStrokeWidth}
          fill="none"
        />

        {geometry.showProgress ? (
          <Circle
            cx={geometry.center}
            cy={geometry.center}
            r={geometry.ringRadius}
            stroke={getProgressStrokeColor(tone, colors)}
            strokeWidth={resolvedStrokeWidth}
            strokeDasharray={geometry.dashArray}
            strokeDashoffset={geometry.dashOffset}
            strokeLinecap="round"
            fill="none"
            transform={geometry.rotateTransform}
          />
        ) : null}

        <Line
          x1={geometry.x1}
          y1={geometry.y1}
          x2={geometry.x2}
          y2={geometry.y2}
          stroke={colors.foreground}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </Svg>

      <View style={styles.centerOverlay} pointerEvents="none">
        <AppText
          tone="default"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[styles.label, geometry.labelStyle]}
        >
          {label}
        </AppText>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fontFamily.semibold,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
