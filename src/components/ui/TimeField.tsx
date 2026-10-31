import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Segmented, type SegmentedOption } from '@/components/ui/Segmented';
import { Stepper } from '@/components/ui/Stepper';
import {
  formatTime12Hour,
  minutesToTimeString,
  timeStringToMinutes,
} from '@/lib/dates';
import { colors, radius, spacing } from '@/theme/tokens';

type Meridiem = 'AM' | 'PM';

const MERIDIEM_OPTIONS: readonly SegmentedOption<Meridiem>[] = [
  { label: 'AM', value: 'AM' },
  { label: 'PM', value: 'PM' },
];

const FALLBACK_TIME = '09:00:00';

export interface TimeFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

function parseTimeParts(timeStr: string): {
  hour12: number;
  minute: number;
  period: Meridiem;
  safeTime: string;
} {
  let totalMinutes: number;
  let safeTime = timeStr;

  try {
    totalMinutes = timeStringToMinutes(timeStr);
  } catch {
    totalMinutes = timeStringToMinutes(FALLBACK_TIME);
    safeTime = FALLBACK_TIME;
  }

  const hours24 = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const period: Meridiem = hours24 >= 12 ? 'PM' : 'AM';
  const hour12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

  return { hour12, minute, period, safeTime };
}

function buildTimeString(
  hour12: number,
  minute: number,
  period: Meridiem
): string {
  const normalizedHour = hour12 % 12;
  const hours24 = period === 'PM' ? normalizedHour + 12 : normalizedHour;
  return minutesToTimeString(hours24 * 60 + minute);
}

function padTwoDigits(num: number): string {
  return num < 10 ? `0${num}` : String(num);
}

export function TimeField({
  label,
  value,
  onChange,
  disabled = false,
  style,
}: TimeFieldProps) {
  const { hour12, minute, period, safeTime } = parseTimeParts(value);
  const formatted = formatTime12Hour(safeTime);

  const handleHourChange = (nextHour: number) => {
    onChange(buildTimeString(nextHour, minute, period));
  };

  const handleMinuteChange = (nextMinute: number) => {
    onChange(buildTimeString(hour12, nextMinute, period));
  };

  const handlePeriodChange = (nextPeriod: Meridiem) => {
    onChange(buildTimeString(hour12, minute, nextPeriod));
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <AppText variant="label">{label}</AppText>
        <AppText variant="label" tone="muted" style={styles.preview}>
          {formatted}
        </AppText>
      </View>

      <View style={styles.box}>
        <Stepper
          label="Hour"
          value={hour12}
          min={1}
          max={12}
          step={1}
          onChange={handleHourChange}
          disabled={disabled}
        />

        <Stepper
          label="Minute"
          value={minute}
          min={0}
          max={55}
          step={5}
          onChange={handleMinuteChange}
          formatValue={padTwoDigits}
          disabled={disabled}
        />

        <Segmented
          options={MERIDIEM_OPTIONS}
          value={period}
          onChange={handlePeriodChange}
          disabled={disabled}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  preview: {
    fontVariant: ['tabular-nums'],
  },
  box: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    padding: spacing.md,
    gap: spacing.md,
  },
});
