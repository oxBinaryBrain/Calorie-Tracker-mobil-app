import * as React from 'react';
import { Animated, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { POPP, POPP_SEMI, styles } from './styles';

// ---------------------------------------------------------------------------
// AppHeader — iOS-style navigation bar: back chevron, centered title, optional
// trailing element. Native-stack headers are disabled app-wide (they do not
// render on web), so this is the single source of navigation chrome.
// ---------------------------------------------------------------------------

// Label shown next the back chevron, iOS-style: the parent screen's name.
const BACK_LABELS: Record<string, string> = {
  Home: 'Home',
  Diary: 'Diary',
  DayDetail: 'Diary',
  EntryDetail: 'Back',
  EntryConfirm: 'Back',
  Trackers: 'Trackers',
  Water: 'Trackers',
  Weight: 'Trackers',
  Sleep: 'Trackers',
  Account: 'Account',
  Profile: 'Profile',
  Goals: 'Goals',
  Paywall: 'Pro',
  Settings: 'Settings',
  Features: 'Features',
  TargetReveal: 'Back',
  Login: 'Sign in',
  Signup: 'Sign in',
  ForgotPassword: 'Sign in',
};

export function AppHeader({ title, onBack, right, hairline = true }: {
  title?: string;
  onBack?: (() => void) | null;
  right?: React.ReactNode;
  hairline?: boolean;
}) {
  const theme = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const canGoBack = typeof (navigation as { canGoBack?: () => boolean }).canGoBack === 'function' && navigation.canGoBack();
  const back = onBack === null ? undefined : onBack ?? (canGoBack ? () => navigation.goBack() : undefined);

  // iOS pattern: chevron + the screen you'd return to. Falls back to a plain
  // chevron when the previous route isn't known.
  const backLabel = React.useMemo(() => {
    try {
      const state = (navigation as { getState?: () => { routes: Array<{ name: string }>; index: number } }).getState?.();
      if (!state || state.index < 1) return null;
      const prev = state.routes[state.index - 1];
      return BACK_LABELS[prev.name] ?? 'Back';
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, title]);
  const showBackLabel = back != null && backLabel != null && backLabel.length <= 9;

  return (
    <View
      style={[
        styles.appHeader,
        // Top inset keeps the bar (and the back button) below the status bar
        // and notch on real iOS/Android devices. Zero on web.
        { paddingTop: insets.top, height: 48 + insets.top },
        hairline && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.outlineVariant },
        { backgroundColor: theme.colors.background },
      ]}
    >
      <View style={styles.appHeaderSide}>
        {back ? (
          <Pressable
            onPress={back}
            hitSlop={{ top: 10, bottom: 10, left: 12, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel={showBackLabel && backLabel ? `Back to ${backLabel}` : 'Back'}
            accessibilityHint="Returns to the previous screen"
            style={({ pressed }) => [
              styles.backBtn,
              // Instant feedback on touch-down; subtle press-in like iOS.
              pressed && { opacity: 0.4, transform: [{ scale: 0.97 }] },
            ]}
          >
            <MaterialCommunityIcons name="chevron-left" size={28} color={theme.colors.primary} />
            {showBackLabel ? (
              <Text numberOfLines={1} style={[styles.backLabel, { color: theme.colors.primary }]}>
                {backLabel}
              </Text>
            ) : null}
          </Pressable>
        ) : null}
      </View>
      <Text numberOfLines={1} accessibilityRole="header" style={[styles.appHeaderTitle, { color: theme.colors.onBackground }]}>
        {title ?? ''}
      </Text>
      <View style={styles.appHeaderSideRight}>{right}</View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen wrapper: consistent paddings + keyboard handling
// ---------------------------------------------------------------------------

export function Screen({ children, style, scroll = true, keyboardShouldPersistTaps = 'handled', title, onBack, right, hairline, refreshing, onRefresh }: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scroll?: boolean;
  keyboardShouldPersistTaps?: 'never' | 'always' | 'handled';
  title?: string;
  onBack?: (() => void) | null;
  right?: React.ReactNode;
  hairline?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const theme = useTheme();
  const header = title || onBack || right ? <AppHeader title={title} onBack={onBack} right={right} hairline={hairline} /> : null;
  const body = <View style={[styles.screenInner, style]}>{children}</View>;
  if (!scroll) {
    return (
      <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
        {header}
        {body}
      </View>
    );
  }
  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      {header}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={{ paddingBottom: 96 }}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode="on-drag"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={!!refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
              progressBackgroundColor={theme.colors.surface}
            />
          ) : undefined
        }
      >
        {body}
      </ScrollView>
    </View>
  );
}

export function HeaderTitle({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <Text accessibilityRole="header" style={{ color: theme.colors.onBackground, fontSize: 18, fontWeight: '600', ...POPP_SEMI }}>
      {text}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// LargeTitleScreen — iOS-style large-title page for top-level tab screens
// (Diary, Trackers, Account). The large title is the first element of the
// scroll content, so it scrolls away like UIKit's large titles; a fixed
// compact bar (title centered, hairline underneath) crossfades in as the
// large title tucks under it.
//
// One Animated.Value drives all three interpolations from onScroll, so no
// renders happen per frame.
// ---------------------------------------------------------------------------

const COMPACT_BAR_HEIGHT = 48;

export function LargeTitleScreen({ title, children, right, contentContainerStyle, scrollY: externalScrollY, refreshing, onRefresh }: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode; // trailing element shown in the compact bar once collapsed
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollY?: Animated.Value; // pass one in to drive your own scroll-linked elements
  refreshing?: boolean; // pull-to-refresh: pass both to enable the system control
  onRefresh?: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const internalScrollY = React.useRef(new Animated.Value(0)).current;
  const scrollY = externalScrollY ?? internalScrollY;

  // Compact bar appears as the large title reaches the bar zone.
  const barOpacity = React.useMemo(
    () => scrollY.interpolate({ inputRange: [4, 30], outputRange: [0, 1], extrapolate: 'clamp' }),
    [scrollY],
  );
  const barTranslateY = React.useMemo(
    () => scrollY.interpolate({ inputRange: [0, 34], outputRange: [-10, 0], extrapolate: 'clamp' }),
    [scrollY],
  );
  // Large title dissolves while sliding under the bar (iOS crossfade).
  const titleOpacity = React.useMemo(
    () => scrollY.interpolate({ inputRange: [10, 38], outputRange: [1, 0], extrapolate: 'clamp' }),
    [scrollY],
  );

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <Animated.ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.largeContent, { paddingTop: insets.top + 8 }, contentContainerStyle]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={!!refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
              progressBackgroundColor={theme.colors.surface}
            />
          ) : undefined
        }
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Animated.View style={{ opacity: titleOpacity }}>
          <Text numberOfLines={1} accessibilityRole="header" style={[styles.largeTitle, { color: theme.colors.onBackground }]}>
            {title}
          </Text>
        </Animated.View>
        {children}
      </Animated.ScrollView>

      {/* Fixed compact bar; box-none lets scroll touches pass through. */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.compactBar,
          {
            paddingTop: insets.top,
            height: COMPACT_BAR_HEIGHT + insets.top,
            opacity: barOpacity,
            transform: [{ translateY: barTranslateY }],
            backgroundColor: theme.colors.background,
            borderBottomColor: theme.colors.outlineVariant,
          },
        ]}
      >
        <View style={styles.compactSide} />
        <Animated.Text numberOfLines={1} accessibilityRole="header" style={[styles.compactTitle, { color: theme.colors.onBackground }]}>
          {title}
        </Animated.Text>
        <View style={styles.compactSideRight}>{right}</View>
      </Animated.View>
    </View>
  );
}

// Typography spread kept alongside the chrome so shared screens can reuse it.
export { POPP, POPP_MED, POPP_SEMI } from './styles';
