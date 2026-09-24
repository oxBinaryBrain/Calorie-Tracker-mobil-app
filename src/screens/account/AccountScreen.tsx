import * as React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, IconButton, useTheme } from 'react-native-paper';
import { useQueryClient } from '@tanstack/react-query';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AccountTabParams } from '../../navigation/types';
import type { ActivityLevel, Goal, Sex } from '../../types';
import { useSession, usePrefs } from '../../stores';
import { useProfile } from '../../hooks/queries';
import { formatMl } from '../../utils';
import { effectiveWaterGoalMl } from '../../services/targets';
import { fontFamilies, semantic } from '../../theme';
import { LargeTitleScreen, PressableRow, SectionTitle } from '../../components/ui';

type Props = NativeStackScreenProps<AccountTabParams, 'Account'>;

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Mostly sitting',
  light: 'Light',
  moderate: 'Moderate',
  active: 'Active',
  athlete: 'Athlete',
};

const GOAL_LABELS: Record<Goal, string> = {
  lose: 'Lose',
  maintain: 'Maintain',
  gain: 'Gain',
};

const SEX_LABELS: Record<Sex, string> = {
  female: 'Female',
  male: 'Male',
  other: 'Other',
};

/** Section heading with a trailing link to the screen that edits it. */
function SectionHeaderRow({ title, onPress }: { title: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.sectionRow}>
      <SectionTitle text={title} style={styles.sectionRowTitle} />
      <Pressable
        onPress={onPress}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${title.toLowerCase()}`}
      >
        <Text style={[styles.sectionAction, { color: theme.colors.primary }]}>Edit</Text>
      </Pressable>
    </View>
  );
}

export default function AccountScreen({ navigation }: Props) {
  const theme = useTheme();
  const s = semantic(theme);
  const qc = useQueryClient();
  const email = useSession((st) => st.email);
  const signOut = useSession((st) => st.signOut);
  const simulatedPro = usePrefs((st) => st.simulatedPro);
  const waterGoalPref = usePrefs((st) => st.waterGoalMl);
  const profile = useProfile();
  const p = profile.data;
  const firstName = (p?.displayName || '').split(' ')[0];
  const displayName = firstName || email?.split('@')[0] || 'Friend';
  const avatar = p?.avatarEmoji ?? '🌿';
  const waterGoal = effectiveWaterGoalMl(waterGoalPref, p?.weightKg, p?.activityLevel);
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ['profile'] });
    setRefreshing(false);
  }, [qc]);

  // Avatar card tucks under the bar: when scrolled, a small avatar fades in
  // next to the compact-bar title, iOS-style.
  const scrollY = React.useRef(new Animated.Value(0)).current;
  const avatarOpacity = React.useMemo(
    () => scrollY.interpolate({ inputRange: [30, 58], outputRange: [0, 1], extrapolate: 'clamp' }),
    [scrollY],
  );

  // Everything below is read straight from the profile and the water goal —
  // no derived "stats" that pretend to be measured.
  const facts: Array<{ label: string; value: string }> = p
    ? [
        { label: 'Weight', value: `${p.weightKg} kg` },
        { label: 'Height', value: `${p.heightCm} cm` },
        { label: 'Age', value: `${p.age}` },
        { label: 'Sex', value: SEX_LABELS[p.sex] },
        { label: 'Activity', value: ACTIVITY_LABELS[p.activityLevel] },
        { label: 'Goal', value: GOAL_LABELS[p.goal] },
        { label: 'Target weight', value: p.targetWeightKg != null ? `${p.targetWeightKg} kg` : '—' },
        { label: 'Water goal', value: formatMl(waterGoal) },
      ]
    : [];

  return (
    <LargeTitleScreen
      title="Account"
      scrollY={scrollY}
      refreshing={refreshing}
      onRefresh={() => void onRefresh()}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 }}
      right={
        <Animated.View style={{ opacity: avatarOpacity, marginRight: 4 }}>
          <View style={[styles.miniAvatar, { backgroundColor: theme.colors.primaryContainer }]}>
            <Text style={styles.miniAvatarText}>{avatar}</Text>
          </View>
        </Animated.View>
      }
    >
      <Card mode="contained" style={[styles.heroCard, { backgroundColor: s.calorieTint }]}>
        <Card.Content style={styles.heroRow}>
          <View style={[styles.avatar, { backgroundColor: theme.colors.surface }]}>
            <Text style={{ fontSize: 30 }}>{avatar}</Text>
          </View>
          <View style={styles.heroText}>
            <Text style={[styles.name, { color: theme.colors.onSurface }]}>{displayName}</Text>
            <Text style={[styles.email, { color: s.mutedText }]}>{email ?? 'Signed in'}</Text>
            <View style={[styles.planPill, { borderColor: theme.colors.outlineVariant }]}>
              <Text style={[styles.planPillText, { color: s.mutedText }]}>
                {simulatedPro ? 'Caloria Pro' : 'Free plan'}
              </Text>
            </View>
          </View>
          <IconButton
            icon="cog"
            size={24}
            iconColor={theme.colors.onSurfaceVariant}
            onPress={() => navigation.navigate('Settings')}
            accessibilityLabel="Settings"
            accessibilityRole="button"
          />
        </Card.Content>
      </Card>

      <SectionHeaderRow title="Your details" onPress={() => navigation.navigate('Profile')} />
      {p ? (
        <Card mode="contained" style={styles.card}>
          <Card.Content style={styles.factGrid}>
            {facts.map((fact) => (
              <View key={fact.label} style={styles.fact}>
                <Text style={[styles.factLabel, { color: theme.colors.onSurfaceVariant }]}>{fact.label}</Text>
                <Text style={[styles.factValue, { color: theme.colors.onSurface }]}>{fact.value}</Text>
              </View>
            ))}
          </Card.Content>
        </Card>
      ) : (
        <Text style={[styles.note, { color: s.mutedText }]}>
          Add your height, weight and goal so the daily numbers stay sensible.
        </Text>
      )}

      <SectionTitle text="Manage" style={styles.sectionGap} />
      <Card mode="contained" style={styles.card}>
        <Card.Content style={styles.gap0}>
          <PressableRow
            label="Features"
            icon="star-outline"
            value="What's inside"
            onPress={() => navigation.navigate('Features')}
          />
          <PressableRow
            label="Caloria Pro"
            icon="crown-outline"
            value={simulatedPro ? 'Active' : 'Free plan'}
            onPress={() => navigation.navigate('Paywall')}
          />
          <PressableRow label="Settings" icon="cog-outline" last onPress={() => navigation.navigate('Settings')} />
        </Card.Content>
      </Card>

      <Pressable
        style={styles.signOut}
        onPress={signOut}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        <MaterialCommunityIcons name="logout" size={18} color={theme.colors.onSurfaceVariant} />
        <Text style={[styles.signOutText, { color: theme.colors.onSurfaceVariant }]}> Sign out</Text>
      </Pressable>
    </LargeTitleScreen>
  );
}

const styles = StyleSheet.create({
  heroCard: { borderRadius: 22, marginTop: 4 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 62, height: 62, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  miniAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  miniAvatarText: { fontSize: 15 },
  heroText: { flex: 1, gap: 2 },
  name: { fontSize: 19, fontFamily: fontFamilies.semibold },
  email: { fontSize: 13, fontFamily: fontFamilies.regular },
  planPill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 1,
    marginTop: 3,
  },
  planPillText: { fontSize: 11, fontFamily: fontFamilies.medium },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 6,
  },
  sectionRowTitle: { marginTop: 0 },
  sectionAction: { fontSize: 13, fontFamily: fontFamilies.medium },
  sectionGap: { marginTop: 16 },
  card: { borderRadius: 16 },
  factGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  fact: { width: '50%' },
  factLabel: { fontSize: 12, fontFamily: fontFamilies.medium },
  factValue: { fontSize: 15, fontFamily: fontFamilies.semibold, marginTop: 1 },
  note: { fontSize: 13.5, fontFamily: fontFamilies.regular, marginBottom: 4 },
  gap0: { paddingVertical: 2, paddingHorizontal: 16 },
  signOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, padding: 8 },
  signOutText: { fontSize: 14.5, fontFamily: fontFamilies.regular },
});
