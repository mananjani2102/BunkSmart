import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { USE_NATIVE_DRIVER, useReduceMotion } from '@/lib/motion';
import { createThemedStyles, useTheme } from '@/theme/ThemeProvider';
import {
  fontFamily,
  motion,
  radius,
  shadows,
  spacing,
  type ThemeColors,
} from '@/theme/tokens';

export type SnackbarTone = 'default' | 'error';

export interface SnackbarItem {
  id: number;
  message: string;
  tone: SnackbarTone;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
}

export interface SnackbarProps {
  item: SnackbarItem | null;
  bottomOffset: number;
  onDismiss: (id: number) => void;
}

const SLIDE_OFFSET = 16;

const getStyles = createThemedStyles((colors: ThemeColors) => ({
  host: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
    zIndex: 50,
  },
  bar: {
    width: '100%',
    maxWidth: 560,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    backgroundColor: colors.popover,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    paddingLeft: spacing.md,
    paddingRight: spacing.md,
    paddingVertical: spacing.xs,
    ...shadows.floating,
  },
  barWithAction: {
    paddingRight: spacing.xs,
  },
  barError: {
    borderColor: colors.destructiveText,
  },
  message: {
    flex: 1,
    paddingVertical: spacing.xs,
  },
  actionBtn: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.small,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  actionBtnPressed: {
    backgroundColor: colors.muted,
  },
  actionText: {
    fontFamily: fontFamily.semibold,
  },
}));

/**
 * Floating snackbar positioned above the bottom tab bar using native opacity
 * and translateY animations.
 */
export function Snackbar({ item, bottomOffset, onDismiss }: SnackbarProps) {
  const { colors, scheme } = useTheme();
  const styles = getStyles(colors, scheme);
  const reduceMotion = useReduceMotion();

  const [prevItem, setPrevItem] = useState<SnackbarItem | null>(item);
  const [renderedItem, setRenderedItem] = useState<SnackbarItem | null>(item);
  const renderedItemRef = useRef<SnackbarItem | null>(item);
  const [opacity] = useState(() => new Animated.Value(item ? 1 : 0));
  const [translateY] = useState(
    () => new Animated.Value(item ? 0 : SLIDE_OFFSET)
  );
  const actionTriggeredIdRef = useRef<number | null>(null);

  if (prevItem !== item) {
    setPrevItem(item);
    if (item) {
      setRenderedItem(item);
    } else if (reduceMotion) {
      setRenderedItem(null);
    }
  }

  useEffect(() => {
    renderedItemRef.current = renderedItem;
  }, [renderedItem]);

  useEffect(() => {
    if (item) {
      if (reduceMotion) {
        opacity.setValue(1);
        translateY.setValue(0);
        return;
      }

      opacity.setValue(0);
      translateY.setValue(SLIDE_OFFSET);

      const enterAnim = Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: motion.transition,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: motion.transition,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]);
      enterAnim.start();

      return () => {
        enterAnim.stop();
      };
    }

    if (!renderedItemRef.current) {
      return;
    }

    if (reduceMotion) {
      opacity.setValue(0);
      translateY.setValue(SLIDE_OFFSET);
      renderedItemRef.current = null;
      return;
    }

    const exitAnim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: motion.snackbarOut,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(translateY, {
        toValue: SLIDE_OFFSET,
        duration: motion.snackbarOut,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]);
    exitAnim.start(({ finished }) => {
      if (finished) {
        renderedItemRef.current = null;
        setRenderedItem(null);
      }
    });

    return () => {
      exitAnim.stop();
    };
  }, [item, opacity, reduceMotion, translateY]);

  if (!renderedItem) {
    return null;
  }

  const isError = renderedItem.tone === 'error';
  const hasAction = Boolean(renderedItem.actionLabel && renderedItem.onAction);

  const handleActionPress = () => {
    if (
      !renderedItem.onAction ||
      actionTriggeredIdRef.current === renderedItem.id
    ) {
      return;
    }
    actionTriggeredIdRef.current = renderedItem.id;
    onDismiss(renderedItem.id);
    void Promise.resolve(renderedItem.onAction()).catch(() => undefined);
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { bottom: bottomOffset }]}
    >
      <Animated.View
        accessibilityLiveRegion={isError ? 'assertive' : 'polite'}
        accessibilityRole="alert"
        style={[
          styles.bar,
          hasAction && styles.barWithAction,
          isError && styles.barError,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        {isError ? (
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color={colors.destructiveText}
          />
        ) : null}

        <AppText variant="label" numberOfLines={3} style={styles.message}>
          {renderedItem.message}
        </AppText>

        {hasAction && renderedItem.actionLabel ? (
          <Pressable
            onPress={handleActionPress}
            android_ripple={{ color: colors.rippleNeutral, foreground: true }}
            accessibilityRole="button"
            accessibilityLabel={renderedItem.actionLabel}
            style={({ pressed }) => [
              styles.actionBtn,
              pressed && styles.actionBtnPressed,
            ]}
          >
            <AppText variant="label" tone="info" style={styles.actionText}>
              {renderedItem.actionLabel}
            </AppText>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}
