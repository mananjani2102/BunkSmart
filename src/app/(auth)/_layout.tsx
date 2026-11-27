import { Stack } from 'expo-router';

import { useReduceMotion } from '@/lib/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { getAuthStackOptions } from '@/theme/navigation';

export const unstable_settings = {
  anchor: 'login',
};

export default function AuthLayout() {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();

  return (
    <Stack screenOptions={getAuthStackOptions(colors, reduceMotion)}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );
}
