import { type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { colors, radius, spacing } from '@/theme/tokens';

export interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

export function Card({
  children,
  onPress,
  style,
  accessibilityLabel,
  testID,
}: CardProps) {
  if (!onPress) {
    return (
      <View style={[styles.card, style]} testID={testID}>
        {children}
      </View>
    );
  }

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.985}
      rippleColor={colors.rippleNeutral}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      containerStyle={[styles.pressableWrapper, style]}
      style={({ pressed }) => [
        styles.pressableContent,
        pressed && styles.pressed,
      ]}
    >
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.lg,
  },
  pressableWrapper: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  pressableContent: {
    padding: spacing.lg,
  },
  pressed: {
    backgroundColor: colors.surfacePressed,
  },
});
