import { type Stack } from 'expo-router';
import { type ComponentProps } from 'react';

import { colors } from '@/theme/tokens';

export type StackScreenOptions = Exclude<
  ComponentProps<typeof Stack.Screen>['options'],
  ((...args: never[]) => unknown) | undefined
>;

export const sharedHeaderOptions: StackScreenOptions = {
  headerShown: true,
  headerStyle: {
    backgroundColor: colors.bg,
  },
  headerShadowVisible: false,
  headerTintColor: colors.text,
  headerTitleStyle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  contentStyle: {
    backgroundColor: colors.bg,
  },
};

export const modalHeaderOptions: StackScreenOptions = {
  ...sharedHeaderOptions,
  presentation: 'modal',
};
