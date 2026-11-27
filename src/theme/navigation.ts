import { type Stack } from 'expo-router';
import { type ComponentProps, createElement } from 'react';

import { HeaderIconButton } from '@/components/ui/HeaderIconButton';
import { motion, typography, type ThemeColors } from '@/theme/tokens';

export type StackScreenOptions = Exclude<
  ComponentProps<typeof Stack.Screen>['options'],
  ((...args: never[]) => unknown) | undefined
>;

function renderBackHeaderLeft({ canGoBack }: { canGoBack?: boolean }) {
  if (!canGoBack) {
    return null;
  }
  return createElement(HeaderIconButton, { variant: 'back' });
}

function renderModalHeaderLeft() {
  return createElement(HeaderIconButton, { variant: 'close' });
}

export function getSharedHeaderOptions(
  colors: ThemeColors,
  reduceMotion = false
): StackScreenOptions {
  return {
    headerShown: true,
    presentation: 'card',
    animation: reduceMotion ? 'none' : 'slide_from_right',
    gestureEnabled: true,
    headerStyle: {
      backgroundColor: colors.background,
    },
    headerShadowVisible: false,
    headerTitleAlign: 'left',
    headerBackVisible: false,
    headerBackButtonDisplayMode: 'minimal',
    headerLeft: renderBackHeaderLeft,
    headerTintColor: colors.foreground,
    headerTitleStyle: {
      color: colors.foreground,
      fontFamily: typography.heading.fontFamily,
      fontSize: typography.heading.fontSize,
      fontWeight: undefined,
    },
    contentStyle: {
      backgroundColor: colors.background,
    },
  };
}

export function getModalHeaderOptions(
  colors: ThemeColors,
  reduceMotion = false
): StackScreenOptions {
  return {
    ...getSharedHeaderOptions(colors, reduceMotion),
    presentation: 'modal',
    animation: reduceMotion ? 'none' : 'slide_from_bottom',
    headerLeft: renderModalHeaderLeft,
  };
}

export function getFadeScreenOptions(
  colors: ThemeColors,
  reduceMotion = false
): StackScreenOptions {
  return {
    headerShown: false,
    presentation: 'card',
    animation: reduceMotion ? 'none' : 'fade',
    animationDuration: reduceMotion ? 0 : motion.transition,
    gestureEnabled: false,
    contentStyle: {
      backgroundColor: colors.background,
    },
  };
}

export function getAuthStackOptions(
  colors: ThemeColors,
  reduceMotion = false
): StackScreenOptions {
  return {
    headerShown: false,
    presentation: 'card',
    animation: reduceMotion ? 'none' : 'slide_from_right',
    gestureEnabled: true,
    contentStyle: {
      backgroundColor: colors.background,
    },
  };
}
