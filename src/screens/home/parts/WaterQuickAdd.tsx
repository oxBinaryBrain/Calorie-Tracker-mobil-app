import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { formatMl } from '../../../utils';
import { fontFamilies, semantic } from '../../../theme';
import { tickLight } from '../../../services/haptics';

/** Quick water chips against the personalized goal (inline on Home). */
export function WaterQuickAdd({ loggedMl, goalMl, onAdd }: {
  loggedMl: number;
  goalMl: number;
  onAdd: (ml: number) => void;
}) {
  const theme = useTheme();
  const s = semantic(theme);
  return (
    <View style={styles.waterRow}>
      <MaterialCommunityIcons name="water-outline" size={16} color={theme.colors.primary} accessibilityElementsHidden importantForAccessibility="no" />
      <Text style={[styles.waterLabel, { color: theme.colors.onSurfaceVariant }]}>Add water</Text>
      {[250, 500].map((ml) => (
        <Pressable
          key={ml}
          onPress={() => {
            tickLight();
            onAdd(ml);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Add ${ml} milliliters of water`}
          style={[styles.waterChip, { backgroundColor: s.waterTint }]}>
          <MaterialCommunityIcons name="plus" size={14} color={theme.colors.primary} accessibilityElementsHidden importantForAccessibility="no" />
          <Text style={[styles.waterChipText, { color: theme.colors.primary }]}>+{ml}</Text>
        </Pressable>
      ))}
      <Text numberOfLines={1} style={[styles.waterGoal, { color: theme.colors.onSurfaceVariant }]}>
        {formatMl(loggedMl)} / {formatMl(goalMl)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  waterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginTop: 12 },
  waterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  waterChipText: { fontSize: 12.5, fontWeight: '600', fontFamily: fontFamilies.semibold },
  waterLabel: { fontSize: 12.5, marginRight: 2, fontFamily: fontFamilies.regular },
  waterGoal: { flex: 1, textAlign: 'right', fontSize: 12.5, fontFamily: fontFamilies.regular },
});
