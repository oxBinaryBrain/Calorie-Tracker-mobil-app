import { Platform } from 'react-native';

/**
 * A soft physical tick for the app's most-repeated gestures — water and other
 * quick-adds. Native only: web has no haptic hardware, and the lazy import
 * keeps the native module out of the web bundle entirely. Failure is silent;
 * a missing tick must never break the action it accompanies.
 */
export function tickLight(): void {
  if (Platform.OS === 'web') return;
  void (async () => {
    try {
      const Haptics = await import('expo-haptics');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Unavailable environment — silence is fine.
    }
  })();
}
