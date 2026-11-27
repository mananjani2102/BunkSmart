import { type StyleProp, type ViewStyle } from 'react-native';

import { type AppTextTone } from '@/components/ui/AppText';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import {
  canSkip,
  clampTarget,
  meetsTarget,
  mustAttend,
  pluralizeClasses,
  type AttendanceLevel,
} from '@/lib/attendance';
import { type ThemeColors } from '@/theme/tokens';

export interface LevelBadgeProps {
  level: AttendanceLevel;
  style?: StyleProp<ViewStyle>;
}

const LEVEL_MAP: Record<AttendanceLevel, { label: string; tone: BadgeTone }> = {
  no_data: {
    label: 'No data',
    tone: 'neutral',
  },
  safe: {
    label: 'On track',
    tone: 'success',
  },
  borderline: {
    label: 'Low buffer',
    tone: 'warning',
  },
  below: {
    label: 'Below target',
    tone: 'destructive',
  },
};

export function getLevelLabel(level: AttendanceLevel): string {
  return LEVEL_MAP[level].label;
}

export function getLevelTextTone(level: AttendanceLevel): AppTextTone {
  switch (level) {
    case 'safe':
      return 'success';
    case 'borderline':
      return 'warning';
    case 'below':
      return 'danger';
    case 'no_data':
    default:
      return 'muted';
  }
}

export function getLevelFillColor(
  level: AttendanceLevel,
  colors: ThemeColors
): string {
  switch (level) {
    case 'safe':
      return colors.success;
    case 'borderline':
      return colors.amber;
    case 'below':
      return colors.destructive;
    case 'no_data':
    default:
      return colors.mutedForeground;
  }
}

export function formatAttendanceActionText(
  attended: number,
  held: number,
  target: number
): string {
  if (held <= 0) {
    return 'No data';
  }

  const clampedTarget = clampTarget(target);
  if (!meetsTarget(attended, held, clampedTarget)) {
    const needed = mustAttend(attended, held, clampedTarget);
    return `Attend next ${needed} ${pluralizeClasses(needed)}`;
  }

  const skipCount = canSkip(attended, held, clampedTarget);
  return `Can skip ${skipCount} ${pluralizeClasses(skipCount)}`;
}

export function LevelBadge({ level, style }: LevelBadgeProps) {
  const config = LEVEL_MAP[level];
  return <Badge label={config.label} tone={config.tone} dot style={style} />;
}
