import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Card, Chip, IconButton, Surface, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useToasts } from '../../stores';
import { styles } from './styles';

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

export function StatTile({ label, value, hint, style, icon, iconColor }: {
  label: string;
  value: string;
  hint?: string;
  style?: StyleProp<ViewStyle>;
  icon?: string;
  iconColor?: string;
}) {
  const theme = useTheme();
  return (
    <Card
      style={[styles.tile, style]}
      mode="contained"
      accessibilityLabel={hint ? `${label}, ${value}, ${hint}` : `${label}, ${value}`}
    >
      <Card.Content>
        <View style={styles.tileLabelRow}>
          {icon ? (
            <MaterialCommunityIcons
              name={icon as any}
              size={15}
              color={iconColor ?? theme.colors.primary}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          ) : null}
          <Text style={[styles.tileLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
        </View>
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
    <View style={styles.empty} accessibilityRole="text" accessibilityLabel={`${title}. ${message}`}>
      <IconButton icon={icon} size={34} iconColor={theme.colors.onSurfaceVariant} accessibilityElementsHidden importantForAccessibility="no" />
      <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>{title}</Text>
      <Text style={[styles.emptyMsg, { color: theme.colors.onSurfaceVariant }]}>{message}</Text>
    </View>
  );
}

export function QuickChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Chip
      mode="outlined"
      onPress={onPress}
      style={styles.chip}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {label}
    </Chip>
  );
}

export function SectionTitle({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
  const theme = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={[styles.section, { color: theme.colors.onSurfaceVariant }, style]}
    >
      {text}
    </Text>
  );
}

export function PressableRow({ label, value, onPress, icon, last }: { label: string; value?: string; onPress: () => void; icon?: string; last?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: theme.colors.surfaceVariant }}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
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
