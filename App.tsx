import * as React from 'react';
import { Platform, StatusBar, StyleSheet, Image, Text, View, useColorScheme } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';

import { RootNavigator } from './src/navigation';
import { ToastHost } from './src/components/ui';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { darkTheme, lightTheme, fontFamilies } from './src/theme';
import { usePrefs, useSession } from './src/stores';
import { initPurchases } from './src/services/purchases';

// Native splash: hold the launch screen until Poppins is ready, then swap.
// Web has no native splash, so a matching inline splash fills the gap.
void SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

/**
 * Poppins is the app face across all platforms. Web gets @font-face rules
 * (the woff2 variable font served from public/fonts); native loads the four
 * TTFs through useFonts and the expo-font config plugin embeds them at build
 * time. The re-asserted `[dir="auto"]` rule overrides react-native-web's
 * hardcoded system stack on every text node, matching the native behavior.
 */
const POPPIN_SOURCES = {
  [fontFamilies.regular]: require('./assets/fonts/Poppins-Regular.ttf'),
  [fontFamilies.medium]: require('./assets/fonts/Poppins-Medium.ttf'),
  [fontFamilies.semibold]: require('./assets/fonts/Poppins-SemiBold.ttf'),
  [fontFamilies.bold]: require('./assets/fonts/Poppins-Bold.ttf'),
} as const;

export default function App() {
  const scheme = useColorScheme();
  const themePref = usePrefs((s) => s.theme);
  const [fontsLoaded] = useFonts(POPPIN_SOURCES);
  const hydrate = usePrefs((s) => s.hydrate);
  const hydrateSession = useSession((s) => s.hydrate);

  React.useEffect(() => {
    hydrate();
    hydrateSession();
    void initPurchases();
  }, [hydrate, hydrateSession]);

  // Explicit choice wins; 'system' follows the OS. Until prefs hydrate this
  // reads the default 'system' — a brief flash of the OS look at cold start.
  const paperTheme = themePref === 'system'
    ? (scheme === 'dark' ? darkTheme : lightTheme)
    : themePref === 'dark' ? darkTheme : lightTheme;

  if (!fontsLoaded) {
    return Platform.OS === 'web' ? (
      <View style={[styles.webSplash, { backgroundColor: '#F6F7F5' }]}>
        <Image source={require('./assets/logo-mark.png')} style={styles.webSplashMark} resizeMode="contain" />
        <Text style={styles.webSplashName}>Caloria</Text>
      </View>
    ) : null;
  }

  void SplashScreen.hideAsync().catch(() => {});

  return (
    <>
      {Platform.OS === 'web' ? (
        <style>{`
          @font-face { font-family: 'Poppins_400Regular'; src: url('/fonts/Poppins-Regular.ttf') format('truetype'); font-weight: 400; font-display: swap; }
          @font-face { font-family: 'Poppins_500Medium'; src: url('/fonts/Poppins-Medium.ttf') format('truetype'); font-weight: 500; font-display: swap; }
          @font-face { font-family: 'Poppins_600SemiBold'; src: url('/fonts/Poppins-SemiBold.ttf') format('truetype'); font-weight: 600; font-display: swap; }
          @font-face { font-family: 'Poppins_700Bold'; src: url('/fonts/Poppins-Bold.ttf') format('truetype'); font-weight: 700; font-display: swap; }
          html, body, #root, #main { height: 100%; margin: 0; overflow: hidden; }
          html { font-family: 'Poppins_400Regular', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
          /* react-native-web hardcodes its own System stack on every text node;
             re-assert Poppins (this <style> sits in body, so it wins the cascade
             over RNW's head-injected classes). No !important: that would also
             beat the inline icon-font families on vector icons. */
          [dir="auto"] { font-family: 'Poppins_400Regular', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
          ::-webkit-scrollbar { width: 0; height: 0; }
          * { -webkit-tap-highlight-color: transparent; }
        `}</style>
      ) : null}
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <PaperProvider theme={paperTheme}>
            <StatusBar barStyle={paperTheme.dark ? 'light-content' : 'dark-content'} />
            <ErrorBoundary>
              <RootNavigator />
            </ErrorBoundary>
            <ToastHost />
          </PaperProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </>
  );
}

const styles = StyleSheet.create({
  webSplash: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  webSplashMark: { width: 64, height: 64 },
  webSplashName: { fontSize: 22, letterSpacing: 0.5, color: '#1B2023', fontWeight: '600' },
});
