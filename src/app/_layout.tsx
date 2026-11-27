import { useFonts } from 'expo-font';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import GeistMedium from '@/assets/fonts/Geist-Medium.ttf';
import GeistRegular from '@/assets/fonts/Geist-Regular.ttf';
import GeistSemiBold from '@/assets/fonts/Geist-SemiBold.ttf';
import { OverviewSkeleton } from '@/components/SkeletonLayouts';
import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { AuthProvider, useAuthState } from '@/context/AuthProvider';
import { DataProvider } from '@/context/DataProvider';
import { RemindersProvider } from '@/context/RemindersProvider';
import { SnackbarProvider } from '@/context/SnackbarProvider';
import { useDelayedVisible, useReduceMotion } from '@/lib/motion';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import {
  getFadeScreenOptions,
  getModalHeaderOptions,
  getSharedHeaderOptions,
} from '@/theme/navigation';
import { fontFamily, spacing } from '@/theme/tokens';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const ERROR_BOUNDARY_EDGES = ['top', 'bottom', 'left', 'right'] as const;
const SPLASH_FALLBACK_TIMEOUT_MS = 4000;

function hideSplashScreen() {
  void SplashScreen.hideAsync().catch(() => undefined);
}

function ErrorBoundaryBody({ retry }: ErrorBoundaryProps) {
  const { scheme } = useTheme();

  useEffect(() => {
    hideSplashScreen();
  }, []);

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
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
    </>
  );
}

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ErrorBoundaryBody {...props} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { session, loading: authLoading } = useAuthState();
  const { colors, scheme, themeLoaded } = useTheme();
  const reduceMotion = useReduceMotion();
  const showBootSkeleton = useDelayedVisible(
    themeLoaded && fontsReady && authLoading
  );
  const appReady = themeLoaded && fontsReady && !authLoading;
  const splashHiddenRef = useRef(false);

  const triggerHideSplash = useCallback(() => {
    if (splashHiddenRef.current) {
      return;
    }
    splashHiddenRef.current = true;
    hideSplashScreen();
  }, []);

  useEffect(() => {
    if (!appReady || Platform.OS !== 'web') {
      return;
    }
    const frameId = requestAnimationFrame(triggerHideSplash);
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [appReady, triggerHideSplash]);

  if (!themeLoaded || !fontsReady) {
    return (
      <View
        style={[
          styles.bootBackdrop,
          { backgroundColor: colors.background },
        ]}
      />
    );
  }

  if (authLoading) {
    return (
      <Screen padded={false} contentContainerStyle={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          {showBootSkeleton ? <OverviewSkeleton delayed={false} /> : null}
        </View>
      </Screen>
    );
  }

  const sharedHeaderOptions = getSharedHeaderOptions(colors, reduceMotion);
  const modalHeaderOptions = getModalHeaderOptions(colors, reduceMotion);
  const fadeScreenOptions = getFadeScreenOptions(colors, reduceMotion);

  return (
    <View
      style={[styles.rootFrame, { backgroundColor: colors.background }]}
      onLayout={triggerHideSplash}
    >
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          presentation: 'card',
          animation: reduceMotion ? 'none' : 'slide_from_right',
          gestureEnabled: true,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Protected guard={Boolean(session)} redirectTo="/(auth)/login">
          <Stack.Screen name="(tabs)" options={fadeScreenOptions} />
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
          <Stack.Screen name="(auth)" options={fadeScreenOptions} />
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
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    [fontFamily.regular]: GeistRegular,
    [fontFamily.medium]: GeistMedium,
    [fontFamily.semibold]: GeistSemiBold,
  });

  const fontsReady = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    const timer = setTimeout(() => {
      hideSplashScreen();
    }, SPLASH_FALLBACK_TIMEOUT_MS);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <DataProvider>
            <RemindersProvider>
              <SnackbarProvider>
                <RootNavigator fontsReady={fontsReady} />
              </SnackbarProvider>
            </RemindersProvider>
          </DataProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  rootFrame: {
    flex: 1,
  },
  bootBackdrop: {
    flex: 1,
  },
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
    paddingTop: spacing.xl + 48,
    paddingBottom: spacing.xxl,
  },
});
