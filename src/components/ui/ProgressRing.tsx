import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { AppText } from '@/components/ui/AppText';
import { clampTarget, type AttendanceTone } from '@/lib/attendance';
import { colors } from '@/theme/tokens';

export interface ProgressRingProps {
  value: number | null;
  target: number;
  size: number;
  strokeWidth?: number;
  tone: AttendanceTone;
  label: string;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

const toneColorMap: Record<AttendanceTone, string> = {
  safe: colors.safe,
  warn: colors.warn,
  danger: colors.danger,
  muted: colors.textMuted,
};

function getLabelFontSize(size: number, isNoData: boolean): number {
  if (size >= 130) {
    return isNoData ? 16 : 24;
  }
  if (size >= 96) {
    return isNoData ? 13 : 18;
  }
  return isNoData ? 11 : 14;
}

export function ProgressRing({
  value,
  target,
  size,
  strokeWidth = Math.max(6, Math.round(size * 0.09)),
  tone,
  label,
  accessibilityLabel,
  style,
}: ProgressRingProps) {
  const tickOverhang = 3;
  const center = size / 2;
  const ringRadius = Math.max(4, (size - strokeWidth) / 2 - tickOverhang);
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
  const tickInner = ringRadius - strokeWidth / 2 - 2;
  const tickOuter = ringRadius + strokeWidth / 2 + 2;
  const x1 = center + tickInner * Math.cos(targetAngle);
  const y1 = center + tickInner * Math.sin(targetAngle);
  const x2 = center + tickOuter * Math.cos(targetAngle);
  const y2 = center + tickOuter * Math.sin(targetAngle);

  const isNoData = value === null;
  const fontSize = getLabelFontSize(size, isNoData);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[styles.container, { width: size, height: size }, style]}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={ringRadius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {showProgress ? (
          <Circle
            cx={center}
            cy={center}
            r={ringRadius}
            stroke={toneColorMap[tone]}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            fill="none"
            transform={`rotate(-90 ${center} ${center})`}
          />
        ) : null}

        <Line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={colors.text}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </Svg>

      <View style={styles.centerOverlay} pointerEvents="none">
        <AppText
          tone={isNoData ? 'muted' : 'default'}
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[
            styles.label,
            {
              fontSize,
              lineHeight: fontSize + 4,
              maxWidth: size - strokeWidth * 2 - 12,
            },
          ]}
        >
          {label}
        </AppText>
      </View>
    </View>
  );
}

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
    fontWeight: '600',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
