import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/context/AuthProvider';
import { DataProvider } from '@/context/DataProvider';
import { modalHeaderOptions, sharedHeaderOptions } from '@/theme/navigation';
import { colors } from '@/theme/tokens';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootNavigator() {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [loading]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
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
      <Stack.Screen name="+not-found" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <DataProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </DataProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
