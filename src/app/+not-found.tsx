import { Stack, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { useAuthState } from '@/context/AuthProvider';
import { useReduceMotion } from '@/lib/motion';
import { useTheme } from '@/theme/ThemeProvider';
import { getSharedHeaderOptions } from '@/theme/navigation';
import { spacing } from '@/theme/tokens';

export default function NotFoundScreen() {
  const { session } = useAuthState();
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const homeHref = session ? '/' : '/(auth)/login';
  const sharedHeaderOptions = getSharedHeaderOptions(colors, reduceMotion);

  return (
    <>
      <Stack.Screen options={{ ...sharedHeaderOptions, title: 'Page Not Found' }} />
      <Screen contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <AppText variant="title" style={styles.title}>
            Page not found
          </AppText>
          <AppText variant="body" tone="muted" style={styles.message}>
            This screen does not exist or was moved.
          </AppText>
          <Button
            title="Go to Home"
            variant="primary"
            onPress={() => {
              router.replace(homeHref);
            }}
          />
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
    marginBottom: spacing.md,
  },
});
