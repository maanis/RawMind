import { useEffect, useState } from 'react';
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
import { useAppStore } from '@/store';
import { useTheme } from '@/hooks/useTheme';
import { View } from 'react-native';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
  },
});

function RootLayoutNav() {
  const { colors, isDark } = useTheme();
  const hydrate = useAppStore((s) => s.hydrate);
  const [initReady, setInitReady] = useState(false);
  const [splashHidden, setSplashHidden] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        await hydrate();
        await new Promise((resolve) => setTimeout(resolve, 350));
      } catch (error) {
        console.error('App initialization failed', error);
      } finally {
        if (!isMounted) return;
        setInitReady(true);
      }
    };

    initialize();

    return () => {
      isMounted = false;
    };
  }, [hydrate]);

  useEffect(() => {
    if (!initReady || splashHidden) return;

    let isMounted = true;

    const finishSplash = async () => {
      await SplashScreen.hideAsync().catch(() => {});
      if (isMounted) {
        setSplashHidden(true);
      }
    };

    finishSplash();

    return () => {
      isMounted = false;
    };
  }, [initReady, splashHidden]);

  if (!splashHidden) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SourceSerif4_400Regular,
    SourceSerif4_600SemiBold,
    SourceSans3_400Regular,
    SourceSans3_500Medium,
    SourceSans3_600SemiBold,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <RootLayoutNav />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
