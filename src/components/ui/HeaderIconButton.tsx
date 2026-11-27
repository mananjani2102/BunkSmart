import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Platform, Pressable } from 'react-native';

import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import { radius, spacing, type ThemeColors } from '@/theme/tokens';

export interface HeaderIconButtonProps {
  variant: 'back' | 'close';
  onPress?: () => void;
}

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  button: {
    width: 44,
    height: 44,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: Platform.OS === 'android' ? spacing.xs : 0,
  },
  pressed: {
    backgroundColor: colors.muted,
  },
}));

export function HeaderIconButton({ variant, onPress }: HeaderIconButtonProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const isClose = variant === 'close';

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={isClose ? 'Close' : 'Go back'}
      android_ripple={{ color: colors.rippleNeutral, foreground: true }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons
        name={isClose ? 'close' : 'arrow-back'}
        size={isClose ? 24 : 22}
        color={colors.foreground}
      />
    </Pressable>
  );
}
