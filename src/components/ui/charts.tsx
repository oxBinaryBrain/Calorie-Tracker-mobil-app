import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import Svg, { Circle, G } from 'react-native-svg';
import { semantic } from '../../theme';
import { formatKcal } from '../../utils';
import { styles } from './styles';

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
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: safeTarget,
        now: Math.round(consumed),
        text: `${formatKcal(consumed)} of ${formatKcal(safeTarget)} calories`,
      }}
    >
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
    { label: 'Carbs', value: carbs, target: targets.carbsGrams, color: s.macroCarbs, tint: s.carbsTint },
    { label: 'Protein', value: protein, target: targets.proteinGrams, color: s.macroProtein, tint: s.proteinTint },
    { label: 'Fat', value: fat, target: targets.fatGrams, color: s.macroFat, tint: s.fatTint },
  ];
  return (
    <View
      style={styles.macroWrap}
      accessibilityRole="progressbar"
      accessibilityValue={{
        text: rows.map((row) => `${row.label} ${Math.round(row.value)} of ${Math.round(row.target)} grams`).join(', '),
      }}
    >
      {rows.map((row) => {
        const pct = Math.min(1, row.target > 0 ? row.value / row.target : 0);
        return (
          <View key={row.label} style={styles.macroRow}>
            <View
              style={[styles.macroDot, { backgroundColor: row.color }]}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <Text style={[styles.macroLabel, { color: theme.colors.onSurfaceVariant }]}>{row.label}</Text>
            <View style={[styles.macroTrack, { backgroundColor: row.tint }]}>
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
