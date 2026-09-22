import * as React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, IconButton, useTheme } from 'react-native-paper';
import { useQueryClient } from '@tanstack/react-query';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AccountTabParams } from '../../navigation/types';
import { useSession, usePrefs } from '../../stores';
import { useProfile } from '../../hooks/queries';
import { LargeTitleScreen, PressableRow, SectionTitle } from '../../components/ui';

type Props = NativeStackScreenProps<AccountTabParams, 'Account'>;

export default function AccountScreen({ navigation }: Props) {
  const theme = useTheme();
  const qc = useQueryClient();
  const email = useSession((s) => s.email);
  const signOut = useSession((s) => s.signOut);
  const simulatedPro = usePrefs((s) => s.simulatedPro);
  const profile = useProfile();
  const p = profile.data;
  const firstName = (p?.displayName || '').split(' ')[0];
  const displayName = firstName || email?.split('@')[0] || 'Friend';
  const avatar = p?.avatarEmoji ?? '🌿';
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
      <Card mode="contained" style={[styles.heroCard, { backgroundColor: theme.colors.primaryContainer }]}>
        <Card.Content style={styles.heroRow}>
          <View style={[styles.avatar, { backgroundColor: theme.colors.surface }]}>
            <Text style={{ fontSize: 30 }}>{avatar}</Text>
          </View>
          <View style={styles.heroText}>
            <Text style={[styles.name, { color: theme.colors.onPrimaryContainer }]}>{displayName}</Text>
            <Text style={[styles.email, { color: theme.colors.onPrimaryContainer, opacity: 0.75 }]}>
              {email ?? 'Signed in'}
            </Text>
            {!simulatedPro ? (
              <Text style={[styles.planTag, { color: theme.colors.onPrimaryContainer, opacity: 0.9 }]}>
                Free plan · Caloria Pro unlocks photo logging and weekly summaries
              </Text>
            ) : (
              <Text style={[styles.planTag, { color: theme.colors.onPrimaryContainer, opacity: 0.9 }]}>
                Caloria Pro · everything unlocked
              </Text>
            )}
          </View>
          <IconButton
            icon="cog"
            size={24}
            iconColor={theme.colors.onPrimaryContainer}
            onPress={() => navigation.navigate('Settings')}
            accessibilityLabel="Settings"
            accessibilityRole="button"
          />
        </Card.Content>
      </Card>

      <SectionTitle text="Manage" style={{ marginTop: 14, marginBottom: 6 }} />
      <Card mode="contained" style={styles.card}>
        <Card.Content style={styles.gap0}>
          <PressableRow label="Profile" icon="account-outline" value={firstName || 'Set up'} onPress={() => navigation.navigate('Profile')} />
          <PressableRow label="Goals & targets" icon="target" onPress={() => navigation.navigate('Goals')} />
          <PressableRow label="Features" icon="star-outline" value="What's inside" onPress={() => navigation.navigate('Features')} />
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
  heroText: { flex: 1, gap: 1 },
  name: { fontSize: 19, fontWeight: '700' },
  email: { fontSize: 13 },
  planTag: { fontSize: 11.5, marginTop: 2 },
  card: { borderRadius: 16 },
  gap0: { paddingVertical: 2, paddingHorizontal: 16 },
  signOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, padding: 8 },
  signOutText: { fontSize: 14.5 },
});
