import React, { useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  SourceSerif4_400Regular,
  SourceSerif4_600SemiBold,
} from '@expo-google-fonts/source-serif-4';
import {
  SourceSans3_400Regular,
  SourceSans3_500Medium,
  SourceSans3_600SemiBold,
} from '@expo-google-fonts/source-sans-3';
import { Text, View, StyleSheet } from 'react-native';

import { useAppStore } from '@/store';
import { useTheme } from '@/hooks/useTheme';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { installGlobalErrorHandling, logError } from '@/utils/logger';
import { toErrorMessage, withTimeout } from '@/utils/safe';

// Prevent auto hide (safe)
SplashScreen.preventAutoHideAsync().catch(() => { });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function RootLayoutNav({ fontsReady }: { fontsReady: boolean }) {
  const { colors, isDark } = useTheme();
  const hydrate = useAppStore((state) => state.hydrate);

  const [initReady, setInitReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const initialize = () => {
      try {
        // 🔥 NON-BLOCKING hydration (IMPORTANT FIX)
        withTimeout(hydrate(), 6000).catch((error) => {
          logError('Hydration failed', error);
          if (isMounted) {
            setInitError(toErrorMessage(error, 'App initialization failed.'));
          }
        });
      } catch (error) {
        logError('Init crash', error);
        if (isMounted) {
          setInitError(toErrorMessage(error));
        }
      } finally {
        // ✅ ALWAYS allow UI to render
        if (isMounted) {
          setTimeout(() => {
            setInitReady(true);
          }, 300);
        }
      }
    };

    initialize();

    return () => {
      isMounted = false;
    };
  }, [hydrate]);

  const appReady = initReady && fontsReady;

  useEffect(() => {
    if (!appReady) return;

    let cancelled = false;

    const hideSplash = async () => {
      try {
        await SplashScreen.hideAsync();
      } catch (error) {
        if (!cancelled) {
          logError('Failed to hide splash', error);
        }
      }
    };

    hideSplash();

    return () => {
      cancelled = true;
    };
  }, [appReady]);

  // 👇 Loading screen (VERY IMPORTANT fallback)
  if (!appReady) {
    return (
      <View
        style={[
          styles.loadingScreen,
          { backgroundColor: colors.background },
        ]}
      />
    );
  }

  return (
    <View style={[styles.appShell, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {initError && (
        <View
          style={[
            styles.errorBanner,
            {
              backgroundColor: colors.accentLight,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.errorBannerText,
              { color: colors.textSecondary },
            ]}
          >
            {initError} Defaults were restored.
          </Text>
        </View>
      )}

      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SourceSerif4_400Regular,
    SourceSerif4_600SemiBold,
    SourceSans3_400Regular,
    SourceSans3_500Medium,
    SourceSans3_600SemiBold,
  });

  useEffect(() => {
    installGlobalErrorHandling();
  }, []);

  useEffect(() => {
    if (fontError) {
      logError('Font loading failed', fontError);
    }
  }, [fontError]);

  // ✅ NEVER block UI because of fonts
  const fontsReady = useMemo(
    () => fontsLoaded || Boolean(fontError),
    [fontsLoaded, fontError]
  );

  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <RootLayoutNav fontsReady={fontsReady} />
        </QueryClientProvider>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
  },
  loadingScreen: {
    flex: 1,
  },
  errorBanner: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorBannerText: {
    fontSize: 13,
    lineHeight: 18,
  },
});