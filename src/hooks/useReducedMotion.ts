import * as React from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * True when the user has asked the system to minimize motion. Web reads the
 * `prefers-reduced-motion` media query; native mirrors AccessibilityInfo.
 * Both track live changes, so flipping the setting mid-session applies to the
 * next animation that runs. Mount-time animations are the consumers here
 * (screen entrance, intro, onboarding steps), so an effect-time read is
 * early enough — no render-phase sync needed.
 */
export function useReducedMotion(): boolean {
  // Lazy initial read: on web the media query is available synchronously, so
  // mount-time animations see the right value on their very first effect run
  // instead of starting to animate and then snapping settled. Native reads
  // async and may briefly start before settling.
  const [reduced, setReduced] = React.useState(() =>
    Platform.OS === 'web' ? (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false) : false,
  );

  React.useEffect(() => {
    if (Platform.OS === 'web') {
      const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
      if (!query) return;
      setReduced(query.matches);
      query.addEventListener?.('change', (event) => setReduced(event.matches));
      return;
    }
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive) setReduced(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
