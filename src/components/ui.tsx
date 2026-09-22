import * as React from 'react';
import { Animated, Easing, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Card, Chip, IconButton, Surface, useTheme } from 'react-native-paper';
import { Image } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Svg, { Circle, G } from 'react-native-svg';
import type { Entry } from '../types';
import { fontFamilies } from '../theme';
import { formatGrams, formatKcal } from '../utils';
import { semantic } from '../theme';
import { useToasts } from '../stores';

// ---------------------------------------------------------------------------
// Typography: Poppins carries every UI string. One spread keeps the app face
// consistent; families already encode their weight (see src/theme).
// ---------------------------------------------------------------------------

const POPP = { fontFamily: fontFamilies.regular };
const POPP_REG = POPP;

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
  // Bumps every time the screen gains focus (initial push, pop-back, tab
  // return), which is exactly when the native transition would re-run.
  const [runId, setRunId] = React.useState(0);
  React.useEffect(() => {
    if (focused) setRunId((n) => n + 1);
  }, [focused]);

  const slide = React.useRef(new Animated.Value(animated ? 0 : 28)).current;
  const fade = React.useRef(new Animated.Value(animated ? 1 : 0)).current;
  // Start settled on native (the stack animates instead) and pre-translate on
  // web so the first frame of the entrance slides in from the right.

  React.useEffect(() => {
    if (animated || runId === 0) return;
    slide.setValue(28);
    fade.setValue(0);
    Animated.parallel([
      Animated.timing(slide, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [runId, animated, slide, fade]);

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
const POPP_MED = { fontFamily: fontFamilies.medium };
const POPP_SEMI = { fontFamily: fontFamilies.semibold };
const POPP_BOLD = { fontFamily: fontFamilies.bold };

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
            accessibilityLabel="Back"
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
      <Text numberOfLines={1} style={[styles.appHeaderTitle, { color: theme.colors.onBackground }]}>
        {title ?? ''}
      </Text>
      <View style={styles.appHeaderSideRight}>{right}</View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen wrapper: consistent paddings + keyboard handling
// ---------------------------------------------------------------------------

export function Screen({ children, style, scroll = true, keyboardShouldPersistTaps = 'handled', title, onBack, right, hairline }: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scroll?: boolean;
  keyboardShouldPersistTaps?: 'never' | 'always' | 'handled';
  title?: string;
  onBack?: (() => void) | null;
  right?: React.ReactNode;
  hairline?: boolean;
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
      >
        {body}
      </ScrollView>
    </View>
  );
}

export function HeaderTitle({ text }: { text: string }) {
  const theme = useTheme();
  return <Text style={{ color: theme.colors.onBackground, fontSize: 18, fontWeight: '600', ...POPP_SEMI }}>{text}</Text>;
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
          <Text numberOfLines={1} style={[styles.largeTitle, { color: theme.colors.onBackground }]}>
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
        <Animated.Text numberOfLines={1} style={[styles.compactTitle, { color: theme.colors.onBackground }]}>
          {title}
        </Animated.Text>
        <View style={styles.compactSideRight}>{right}</View>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Calorie ring (pure react-native-svg)
// ---------------------------------------------------------------------------

export function CalorieRing({ size = 190, consumed, target, burned = 0, center }: {
  size?: number;
  consumed: number;
  target: number;
  burned?: number;
  /** Replaces the default "consumed of target" center block. */
  center?: React.ReactNode;
}) {
  const theme = useTheme();
  const s = semantic(theme);
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const safeTarget = Math.max(1, target);
  const fraction = Math.max(0, Math.min(1, consumed / safeTarget));
  const over = consumed > safeTarget;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={s.ringTrack} strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={s.ringProgress}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={c * (1 - fraction)}
            opacity={over ? 0.5 : 1}
          />
        </G>
      </Svg>
      {center ? (
        <View style={styles.ringCenter}>{center}</View>
      ) : (
        <View style={styles.ringCenter}>
          <Text style={[styles.ringValue, { color: theme.colors.onBackground }]}>{formatKcal(consumed)}</Text>
          <Text style={[styles.ringSub, { color: over ? s.overTargetText : theme.colors.onSurfaceVariant }]}>
            of {formatKcal(safeTarget)} today
            {burned > 0 ? ` · ${formatKcal(burned)} burned` : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Macro bars
// ---------------------------------------------------------------------------

export function MacroBars({ carbs, protein, fat, targets }: {
  carbs: number;
  protein: number;
  fat: number;
  targets: { carbsGrams: number; proteinGrams: number; fatGrams: number };
}) {
  const theme = useTheme();
  const s = semantic(theme);
  const rows = [
    { label: 'Carbs', value: carbs, target: targets.carbsGrams, color: s.macroCarbs },
    { label: 'Protein', value: protein, target: targets.proteinGrams, color: s.macroProtein },
    { label: 'Fat', value: fat, target: targets.fatGrams, color: s.macroFat },
  ];
  return (
    <View style={styles.macroWrap}>
      {rows.map((row) => {
        const pct = Math.min(1, row.target > 0 ? row.value / row.target : 0);
        return (
          <View key={row.label} style={styles.macroRow}>
            <Text style={[styles.macroLabel, { color: theme.colors.onSurfaceVariant }]}>{row.label}</Text>
            <View style={[styles.macroTrack, { backgroundColor: s.ringTrack }]}>
              <View style={[styles.macroFill, { backgroundColor: row.color, width: `${Math.round(pct * 100)}%` }]} />
            </View>
            <Text style={[styles.macroValue, { color: theme.colors.onSurface }]}>
              {Math.round(row.value)} / {Math.round(row.target)} g
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Macro ring tile — image-style mini progress ring with an icon center
// ---------------------------------------------------------------------------

export function MacroRingTile({ value, unit, progress, over, label, overLabel, color, icon, onPress, style }: {
  /** Number shown on top: grams left, or grams over (positive). */
  value: number;
  unit: string;
  /** 0..1 consumed fraction driving the ring. */
  progress: number;
  over: boolean;
  label: string;
  overLabel: string;
  color: string;
  icon: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const s = semantic(theme);
  const size = 62;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, progress));
  const Body = (
    <>
      <Text style={[styles.mrtValue, { color: theme.colors.onBackground }]}>
        {Math.round(value)}
        <Text style={{ color: theme.colors.onSurfaceVariant }}>{unit}</Text>
      </Text>
      <Text style={[styles.mrtLabel, { color: theme.colors.onSurfaceVariant }]}>{over ? overLabel : label}</Text>
      <View style={{ width: size, height: size, marginTop: 10, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={s.ringTrack} strokeWidth={stroke} fill="none" />
            <Circle
              cx={size / 2} cy={size / 2} r={r}
              stroke={color}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${c} ${c}`}
              strokeDashoffset={c * (1 - pct)}
            />
          </G>
        </Svg>
        <MaterialCommunityIcons name={icon as any} size={17} color={over ? theme.colors.onSurfaceVariant : color} />

      </View>
    </>
  );
  const card = [
    styles.mrtCard,
    style,
  ] as const;
  if (!onPress) {
    return <View style={[...card, { backgroundColor: theme.colors.surface }]}>{Body}</View>;
  }
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [...card, { backgroundColor: theme.colors.surface }, pressed && { opacity: 0.7 }]}>
      {Body}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Gentle toast overlay (plain info, never alarms)
// ---------------------------------------------------------------------------

export function ToastHost() {
  const { toasts } = useToasts();
  const theme = useTheme();
  return (
    <View pointerEvents="none" style={styles.toastHost}>
      {toasts.map((t) => (
        <Surface key={t.id} style={[styles.toast, { backgroundColor: theme.colors.inverseSurface }]}>
          <Text style={{ color: theme.colors.inverseOnSurface }}>{t.text}</Text>
        </Surface>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stat tiles, info rows, empty states, chips
// ---------------------------------------------------------------------------

export function StatTile({ label, value, hint, style }: {
  label: string;
  value: string;
  hint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <Card style={[styles.tile, style]} mode="contained">
      <Card.Content>
        <Text style={[styles.tileLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
        <Text style={[styles.tileValue, { color: theme.colors.onSurface }]}>{value}</Text>
        {hint ? <Text style={[styles.tileHint, { color: theme.colors.onSurfaceVariant }]}>{hint}</Text> : null}
      </Card.Content>
    </Card>
  );
}

export function InfoRow({ label, value, style }: {
  label: string;
  value: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.infoRow, style]}>
      <Text style={[styles.infoLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: theme.colors.onSurface }]}>{value}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, message }: { icon: string; title: string; message: string }) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <IconButton icon={icon} size={34} iconColor={theme.colors.onSurfaceVariant} />
      <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>{title}</Text>
      <Text style={[styles.emptyMsg, { color: theme.colors.onSurfaceVariant }]}>{message}</Text>
    </View>
  );
}

export function QuickChip({ label, onPress }: { label: string; onPress: () => void }) {
  return <Chip mode="outlined" onPress={onPress} style={styles.chip}>{label}</Chip>;
}

export function SectionTitle({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
  const theme = useTheme();
  return <Text style={[styles.section, { color: theme.colors.onSurfaceVariant }, style]}>{text}</Text>;
}

export function PressableRow({ label, value, onPress, icon, last }: { label: string; value?: string; onPress: () => void; icon?: string; last?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: theme.colors.surfaceVariant }}
      style={({ pressed }) => [
        styles.pressRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.outlineVariant },
        pressed && { opacity: 0.7 },
      ]}
    >
      {icon ? (
        <MaterialCommunityIcons name={icon as any} size={20} color={theme.colors.primary} style={styles.pressRowIcon} />
      ) : null}
      <Text style={[styles.infoLabel, { color: theme.colors.onSurface }, styles.pressRowLabel]}>{label}</Text>
      <Text style={[styles.infoValue, { color: theme.colors.onSurfaceVariant }]}>{value ?? '›'}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Entry list (shared by Home and Diary DayDetail)
// ---------------------------------------------------------------------------

export function EntryList({ entries, onPressEntry, emptyIcon = 'silverware-fork-knife', emptyTitle = 'Nothing logged yet', emptyMessage = 'Describe a meal below to get started.' }: {
  entries: Entry[];
  onPressEntry?: (entry: Entry) => void;
  emptyIcon?: string;
  emptyTitle?: string;
  emptyMessage?: string;
}) {
  if (entries.length === 0) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} message={emptyMessage} />;
  }
  return (
    <View>
      {entries.map((entry) => (
        <EntryCard key={entry.id} entry={entry} onPress={onPressEntry ? () => onPressEntry(entry) : undefined} />
      ))}
    </View>
  );
}

export function EntryCard({ entry, onPress }: { entry: Entry; onPress?: () => void }) {
  const theme = useTheme();
  const s = semantic(theme);
  const isFood = entry.type === 'food';
  return (
    <Card mode="contained" onPress={onPress} style={styles.entryCard}>
      <Card.Content style={styles.entryContent}>
        {/* Image-style slot: a real photo when the entry has one; otherwise a
            quiet tinted tile with the kind's icon (no fake imagery). */}
        <View style={[styles.entryThumb, { backgroundColor: theme.colors.surfaceVariant }]}>
          {entry.photoUrl ? (
            <Image source={{ uri: entry.photoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <MaterialCommunityIcons
              name={(isFood ? 'food-outline' : 'run')} as any
              size={22}
              color={theme.colors.onSurfaceVariant}
            />
          )}
        </View>
        <View style={styles.entryLeft}>
          <View style={styles.entryTitleRow}>
            <Text style={[styles.entryTitle, { color: theme.colors.onSurface }]}>{entry.title}</Text>
            <Text style={[styles.entryTime, { color: theme.colors.onSurfaceVariant }]}>
              {new Date(entry.loggedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
            </Text>
          </View>
          <Text style={[styles.entryKcal, { color: theme.colors.onSurface }]}>
            {isFood ? `+ ${formatKcal(entry.calories)} kcal` : entry.caloriesBurned ? `− ${formatKcal(entry.caloriesBurned)} kcal` : 'Movement'}
          </Text>
          <View style={styles.entryChips}>
            {isFood ? (
              <>
                {entry.grams != null ? <EntryChip icon="weight" text={`${Math.round(entry.grams)} g`} /> : null}
                {(entry.carbs ?? 0) > 0 ? <EntryChip icon="barley" text={`${Math.round(entry.carbs ?? 0)} g`} /> : null}
                {(entry.protein ?? 0) > 0 ? <EntryChip icon="egg-outline" text={`${Math.round(entry.protein ?? 0)} g`} /> : null}
                {(entry.fat ?? 0) > 0 ? <EntryChip icon="water" text={`${Math.round(entry.fat ?? 0)} g`} /> : null}
              </>
            ) : (
              entry.caloriesBurned ? <EntryChip icon="fire" text={`${formatKcal(entry.caloriesBurned)} burned`} /> : null
            )}
            {entry.note ? <EntryChip icon="note-text-outline" text={entry.note} /> : null}
          </View>
        </View>
      </Card.Content>
    </Card>
  );
}

function EntryChip({ icon, text }: { icon: string; text: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.entryChip, { backgroundColor: theme.dark ? theme.colors.surfaceVariant : '#F3F4F1' }]}>
      <MaterialCommunityIcons name={icon as any} size={11} color={theme.colors.onSurfaceVariant} />
      <Text numberOfLines={1} style={[styles.entryChipText, { color: theme.colors.onSurfaceVariant }]}>{text}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screenInner: { padding: 16, gap: 12 },
  appHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  appHeaderSide: { minWidth: 40, alignItems: 'flex-start' },
  appHeaderSideRight: { minWidth: 40, alignItems: 'flex-end' },
  appHeaderTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', ...POPP_SEMI },
  backBtn: { minHeight: 40, paddingHorizontal: 2, borderRadius: 16, flexDirection: 'row', alignItems: 'center' },
  backLabel: { fontSize: 17, marginLeft: -3, ...POPP },
  largeContent: { paddingBottom: 96 },
  largeTitle: { fontSize: 34, fontWeight: '700', lineHeight: 41, letterSpacing: 0.37, paddingHorizontal: 16, marginBottom: 8, ...POPP_SEMI },
  compactBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  compactSide: { minWidth: 40 },
  compactSideRight: { minWidth: 40, alignItems: 'flex-end' },
  compactTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', ...POPP_SEMI },
  ringCenter: { position: 'absolute', alignItems: 'center', paddingHorizontal: 24 },
  ringValue: { fontSize: 34, fontWeight: '600', ...POPP_SEMI },
  ringSub: { fontSize: 12.5, marginTop: 2, textAlign: 'center', ...POPP_REG },
  macroWrap: { gap: 8 },
  macroRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  macroLabel: { width: 64, fontSize: 13, ...POPP_REG },
  macroTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  macroFill: { height: 8, borderRadius: 4 },
  macroValue: { width: 92, fontSize: 12, textAlign: 'right', ...POPP_MED },
  toastHost: { position: 'absolute', bottom: 90, left: 16, right: 16, alignItems: 'center', zIndex: 10 },
  toast: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, elevation: 2 },
  tile: { borderRadius: 16, flex: 1 },
  tileLabel: { fontSize: 12, ...POPP_MED },
  tileValue: { fontSize: 20, fontWeight: '600', marginTop: 2, ...POPP_SEMI },
  tileHint: { fontSize: 11.5, marginTop: 2, ...POPP_REG },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  infoLabel: { fontSize: 14, ...POPP_REG },
  infoValue: { fontSize: 14, fontWeight: '500', ...POPP_MED },
  pressRow: { paddingVertical: 13, flexDirection: 'row', alignItems: 'center' },
  pressRowIcon: { marginRight: 12 },
  pressRowLabel: { flex: 1, ...POPP_REG },
  empty: { alignItems: 'center', paddingVertical: 36, gap: 4 },
  emptyTitle: { fontSize: 15, fontWeight: '500', ...POPP_MED },
  emptyMsg: { fontSize: 13, textAlign: 'center', maxWidth: 260, ...POPP_REG },
  chip: { margin: 2 },
  section: { fontSize: 13, fontWeight: '600', letterSpacing: 0.3, marginTop: 8, ...POPP_SEMI },
  entryCard: { borderRadius: 16, marginBottom: 8 },
  entryContent: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  entryThumb: {
    width: 64, height: 64, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  entryLeft: { flex: 1, gap: 3 },
  entryTitleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  entryTitle: { fontSize: 15.5, flexShrink: 1, ...POPP_MED },
  entryTime: { fontSize: 11.5, ...POPP_REG },
  entryKcal: { fontSize: 15, fontWeight: '600', ...POPP_SEMI },
  entryChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  entryChip: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, maxWidth: '100%' },
  entryChipText: { fontSize: 11, ...POPP_MED },
  mrtCard: {
    flex: 1, borderRadius: 18, alignItems: 'center', paddingTop: 14, paddingBottom: 14, gap: 1,
  },
  mrtValue: { fontSize: 20, fontWeight: '600', ...POPP_SEMI },
  mrtLabel: { fontSize: 12, marginTop: 1, ...POPP_REG },
});
