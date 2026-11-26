import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { AuthProvider, useAuth } from '@/context/AuthProvider';
import { DataProvider } from '@/context/DataProvider';
import { RemindersProvider } from '@/context/RemindersProvider';
import { modalHeaderOptions, sharedHeaderOptions } from '@/theme/navigation';
import { spacing } from '@/theme/tokens';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const ERROR_BOUNDARY_EDGES = ['top', 'bottom', 'left', 'right'] as const;

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Screen
        edges={ERROR_BOUNDARY_EDGES}
        contentContainerStyle={styles.errorContainer}
      >
        <ErrorState
          title="Something went wrong."
          message="Tap Try again to reload this screen."
          onRetry={() => {
            void retry();
          }}
        />
      </Screen>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [loading]);

  if (loading) {
    return (
      <Screen padded={false} contentContainerStyle={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ gap: 4 }}>
              <Skeleton width={110} height={14} />
              <Skeleton width={180} height={26} />
            </View>
            <Skeleton width={38} height={38} borderRadius={19} />
          </View>
          <Card style={styles.loadingCard}>
            <View style={styles.loadingRow}>
              <Skeleton width={112} height={112} borderRadius={56} />
              <View style={styles.loadingColumn}>
                <Skeleton width="60%" height={20} />
                <Skeleton width="85%" height={16} />
                <Skeleton width="100%" height={36} borderRadius={8} />
              </View>
            </View>
            <Skeleton width="100%" height={8} borderRadius={4} style={{ marginTop: 14 }} />
          </Card>
          <Card style={styles.loadingCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Skeleton width={38} height={38} borderRadius={19} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="50%" height={18} />
                <Skeleton width="75%" height={14} />
              </View>
            </View>
          </Card>
          {[1, 2].map((key) => (
            <Card key={`boot-skel-${key}`} style={styles.loadingCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Skeleton width={44} height={44} borderRadius={22} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Skeleton width="60%" height={18} />
                  <Skeleton width="40%" height={14} />
                </View>
                <Skeleton width={60} height={24} borderRadius={8} />
              </View>
            </Card>
          ))}
        </View>
      </Screen>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={Boolean(session)} redirectTo="/(auth)/login">
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="subject-form"
          options={{ ...modalHeaderOptions, title: 'New subject' }}
        />
        <Stack.Screen
          name="slot-form"
          options={{ ...modalHeaderOptions, title: 'New class' }}
        />
        <Stack.Screen
          name="timetable-import"
          options={{ ...modalHeaderOptions, title: 'Import timetable' }}
        />
        <Stack.Screen
          name="starting-attendance"
          options={{ ...modalHeaderOptions, title: 'Starting attendance' }}
        />
        <Stack.Screen
          name="past-attendance"
          options={{ ...modalHeaderOptions, title: 'Past attendance' }}
        />
        <Stack.Screen
          name="subject/[id]"
          options={{ ...sharedHeaderOptions, title: 'Subject' }}
        />
        <Stack.Screen
          name="simulator"
          options={{ ...sharedHeaderOptions, title: 'What-if simulator' }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!session} redirectTo="/">
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Screen
        name="legal/privacy"
        options={{ ...sharedHeaderOptions, title: 'Privacy Policy' }}
      />
      <Stack.Screen
        name="legal/terms"
        options={{ ...sharedHeaderOptions, title: 'Terms and Conditions' }}
      />
      <Stack.Screen
        name="+not-found"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <DataProvider>
          <RemindersProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </RemindersProvider>
        </DataProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  loadingContainer: {
    flexGrow: 1,
  },
  loadingContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  loadingCard: {
    width: '100%',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  loadingColumn: {
    flex: 1,
    gap: spacing.sm,
  },
  loadingGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  loadingHalfCard: {
    flex: 1,
  },
});
