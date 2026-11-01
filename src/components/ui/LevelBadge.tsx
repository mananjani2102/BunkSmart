import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { type AttendanceLevel } from '@/lib/attendance';
import { colors, radius, spacing } from '@/theme/tokens';

export interface LevelBadgeProps {
  level: AttendanceLevel;
  style?: StyleProp<ViewStyle>;
}

interface LevelBadgeConfig {
  label: string;
  textColor: string;
  backgroundColor: string;
}

const LEVEL_CONFIG: Record<AttendanceLevel, LevelBadgeConfig> = {
  no_data: {
    label: 'No data',
    textColor: colors.textMuted,
    backgroundColor: colors.surfaceMuted,
  },
  safe: {
    label: 'On track',
    textColor: colors.safe,
    backgroundColor: colors.safeBg,
  },
  borderline: {
    label: 'Borderline',
    textColor: colors.warn,
    backgroundColor: colors.warnBg,
  },
  below: {
    label: 'Below target',
    textColor: colors.danger,
    backgroundColor: colors.dangerBg,
  },
};

export function LevelBadge({ level, style }: LevelBadgeProps) {
  const config = LEVEL_CONFIG[level];

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.backgroundColor },
        style,
      ]}
    >
      <AppText
        variant="caption"
        style={[styles.text, { color: config.textColor }]}
        numberOfLines={1}
      >
        {config.label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.small,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  text: {
    fontWeight: '600',
  },
});
