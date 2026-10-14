import * as React from 'react';
import { Animated, Easing, Platform } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { styles } from './styles';

// ---------------------------------------------------------------------------
// ScreenEntrance — web stand-in for the native-stack slide transition. On web
// the native stack does not animate (react-native-screens animates on iOS/
// Android only), so pushed screens run a short iOS-like slide+fade on focus.
// With withEntrance() it can also wrap a screen component; on native it is a
// no-op so the real stack transition plays unencumbered.
// ---------------------------------------------------------------------------

export function ScreenEntrance({ children }: { children: React.ReactNode }) {
  const animated = Platform.OS !== 'web';
  const focused = useIsFocused();
  // Respect the system "reduce motion" setting: skip the slide/fade and render
  // settled, the way a native stack transition respects the same switch.
  const reduceMotion = useReducedMotion();
  // Bumps every time the screen gains focus (initial push, pop-back, tab
  // return), which is exactly when the native transition would re-run.
  const [runId, setRunId] = React.useState(0);
  React.useEffect(() => {
    if (focused) setRunId((n) => n + 1);
  }, [focused]);

  // Start settled on native (the stack animates instead) and pre-translate on
  // web so the first frame of the entrance slides in from the right. With
  // reduce motion the very first frame is already settled, so there is not
  // even a single-frame offset before the effect corrects it.
  const slide = React.useRef(new Animated.Value(animated || reduceMotion ? 0 : 28)).current;
  const fade = React.useRef(new Animated.Value(animated || reduceMotion ? 1 : 0)).current;

  React.useEffect(() => {
    if (animated || runId === 0) return;
    if (reduceMotion) {
      slide.setValue(0);
      fade.setValue(1);
      return;
    }
    slide.setValue(28);
    fade.setValue(0);
    Animated.parallel([
      Animated.timing(slide, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [runId, animated, slide, fade, reduceMotion]);

  if (animated) return <>{children}</>;
  return (
    <Animated.View style={[styles.flex, { opacity: fade, transform: [{ translateX: slide }] }]}>
      {children}
    </Animated.View>
  );
}

/** Wrap a screen so it animates itself in on web (no-op on native). */
export function withEntrance<P extends object>(Component: React.ComponentType<P>): React.ComponentType<P> {
  function Entranced(props: P) {
    return (
      <ScreenEntrance>
        <Component {...props} />
      </ScreenEntrance>
    );
  }
  Entranced.displayName = `withEntrance(${Component.displayName || Component.name || 'Screen'})`;
  return Entranced;
}
