import * as React from 'react';
import { Pressable, StyleSheet, Text, TextInput as RNTextInput, View } from 'react-native';
import { Button, HelperText, TextInput, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { fontFamilies } from '../theme';

export type Choice<T extends string> = { value: T; label: string };

/**
 * One option in a radio group. A plain Pressable rather than Paper's Chip:
 * the Chip keeps the radio role on an inner touchable and its selected state
 * in the legacy accessibilityState object, so neither web nor native
 * assistive tech is told which option is chosen.
 */
export function ChoicePill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      aria-checked={selected}
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [
        styles.choice,
        {
          backgroundColor: selected ? theme.colors.primaryContainer : theme.colors.surface,
          borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {selected ? <MaterialCommunityIcons name="check" size={15} color={theme.colors.onPrimaryContainer} /> : null}
      <Text style={[styles.choiceLabel, { color: selected ? theme.colors.onPrimaryContainer : theme.colors.onSurface }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  columns = 3,
}: {
  label: string;
  options: Array<Choice<T>>;
  value: T | undefined;
  onChange: (v: T) => void;
  columns?: number;
}) {
  const theme = useTheme();
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
      <View style={[styles.rowWrap, { maxWidth: columns * 130 }]}>
        {options.map((opt) => (
          <ChoicePill
            key={opt.value}
            label={opt.label}
            selected={opt.value === value}
            onPress={() => onChange(opt.value)}
          />
        ))}
      </View>
    </View>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  suffix,
  placeholder,
  autoFocus,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  suffix?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [text, setText] = React.useState(value != null ? String(value) : '');
  // Adopt a number changed elsewhere (reset, refetch) while leaving what is
  // being typed alone: "56." parses to 56, so a typed decimal point survives.
  React.useEffect(() => {
    if (value == null) {
      if (text !== '') setText('');
      return;
    }
    if (Number(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <TextInput
      label={suffix ? `${label} (${suffix})` : label}
      value={text}
      onChangeText={(t) => {
        const cleaned = t.replace(',', '.').replace(/[^0-9.]/g, '');
        setText(cleaned);
        const n = Number(cleaned);
        onChange(cleaned !== '' && Number.isFinite(n) ? n : undefined);
      }}
      keyboardType="decimal-pad"
      mode="outlined"
      placeholder={placeholder}
      autoFocus={autoFocus}
      accessibilityLabel={suffix ? `${label} in ${suffix}` : label}
      style={styles.field}
    />
  );
}

export function PrimaryButton({ loading, disabled, onPress, children, style }: {
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <Button
      mode="contained"
      onPress={onPress}
      loading={loading}
      disabled={disabled || loading}
      style={[styles.button, style]}
      contentStyle={styles.buttonContent}
      accessibilityRole="button"
    >
      {children}
    </Button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <HelperText type="info" visible style={styles.error} accessibilityLiveRegion="polite">
      {message}
    </HelperText>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  label: { fontSize: 13, fontWeight: '500', fontFamily: fontFamilies.medium },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
  choice: {
    margin: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  choiceLabel: { fontSize: 13, fontFamily: fontFamilies.medium },
  // Shape lock: inputs 12, buttons pill. 44pt+ tall so the CTA clears the
  // tap-target floor.
  field: { borderRadius: 12 },
  button: { borderRadius: 999, marginTop: 8 },
  buttonContent: { paddingVertical: 8 },
  error: { color: undefined },
});
