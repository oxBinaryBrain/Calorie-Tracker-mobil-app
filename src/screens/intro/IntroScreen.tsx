import * as React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Animated, Easing } from 'react-native';
import { useTheme } from 'react-native-paper';
import { fontFamilies } from '../../theme';

/**
 * Gentle animated intro: logo scales in with the wordmark, a thin line draws
 * beneath it, then the app fades through. Runs once per launch (~2.2s).
 */
export default function IntroScreen({ onDone: rawOnDone }: { onDone: () => void }) {
  // Stable callbacks: a fresh arrow here re-ran the whole animation sequence
  // (and reset the graph) on every parent re-render — on web that could
  // swallow the finished callback and leave the splash stuck at opacity 0.
  const doneRef = React.useRef(rawOnDone);
  const stableDone = React.useCallback(() => doneRef.current(), []);
  const theme = useTheme();
  const logoScale = React.useMemo(() => new Animated.Value(0.6), []);
  const logoOpacity = React.useMemo(() => new Animated.Value(0), []);
  const titleOpacity = React.useMemo(() => new Animated.Value(0), []);
  const titleTranslate = React.useMemo(() => new Animated.Value(14), []);
  const taglineOpacity = React.useMemo(() => new Animated.Value(0), []);
  const lineWidth = React.useMemo(() => new Animated.Value(0), []);
  const fadeOut = React.useMemo(() => new Animated.Value(1), []);

  React.useEffect(() => {
    const animations = Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(titleTranslate, {
          toValue: 0,
          duration: 450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(taglineOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(lineWidth, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ]),
      Animated.delay(600),
      Animated.timing(fadeOut, { toValue: 0, duration: 420, useNativeDriver: true }),
    ]);
    animations.start(({ finished }) => {
      if (finished) stableDone();
    });
    // Belt and braces: whatever happens to the Animated graph (an interrupted
    // callback, a StrictMode remount mid-sequence), the splash can never
    // strand the user — it always dismisses shortly after its natural end.
    const safety = setTimeout(stableDone, 5000);
    return () => {
      animations.stop();
      clearTimeout(safety);
    };
  }, [stableDone, logoScale, logoOpacity, titleOpacity, titleTranslate, taglineOpacity, lineWidth, fadeOut]);

  return (
    <Animated.View style={[styles.flex, { opacity: fadeOut, backgroundColor: theme.colors.background }]}>
      <SafeAreaView style={styles.center}>
        <Animated.View
          style={[
            styles.logo,
            { backgroundColor: theme.colors.primaryContainer, opacity: logoOpacity, transform: [{ scale: logoScale }] },
          ]}
        >
          <MaterialCommunityIcons name="leaf" size={44} color={theme.colors.onPrimaryContainer} />
        </Animated.View>
        <Animated.Text
          style={[
            styles.title,
            { color: theme.colors.onBackground, opacity: titleOpacity, transform: [{ translateY: titleTranslate }] },
          ]}
        >
          Caloria
        </Animated.Text>
        <Animated.View style={[styles.line, { backgroundColor: theme.colors.primary, width: lineWidth.interpolate({ inputRange: [0, 1], outputRange: [0, 120] }) }]} />
        <Animated.Text style={[styles.tagline, { color: theme.colors.onSurfaceVariant, opacity: taglineOpacity }]}>
          A calm food & movement diary
        </Animated.Text>
      </SafeAreaView>
      <Animated.View style={[styles.footer, { opacity: taglineOpacity }]}>
        <ActivityIndicator color={theme.colors.primary} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  leaf: { fontSize: 44 },
  title: { fontSize: 30, letterSpacing: 0.5, fontFamily: fontFamilies.semibold },
  line: { height: 3, borderRadius: 2, marginTop: 2 },
  tagline: { fontSize: 14.5, fontFamily: fontFamilies.regular },
  footer: { position: 'absolute', bottom: 48, left: 0, right: 0, alignItems: 'center' },
});
