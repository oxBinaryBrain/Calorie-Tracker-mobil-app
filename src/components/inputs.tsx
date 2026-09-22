import * as React from 'react';
import { StyleSheet, Text, TextInput as RNTextInput, View } from 'react-native';
import { Button, Chip, HelperText, TextInput, useTheme } from 'react-native-paper';
import { fontFamilies } from '../theme';

export type Choice<T extends string> = { value: T; label: string };

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
    <View style={styles.group}>
      <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
      <View style={[styles.rowWrap, { maxWidth: columns * 130 }]}>
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <Chip
              key={opt.value}
              selected={selected}
              onPress={() => onChange(opt.value)}
              style={[styles.choice, selected && { backgroundColor: theme.colors.primaryContainer }]}
              textStyle={{ color: selected ? theme.colors.onPrimaryContainer : theme.colors.onSurface }}
            >
              {opt.label}
            </Chip>
          );
        })}
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
  React.useEffect(() => {
    if (value == null && text !== '') setText('');
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
    >
      {children}
    </Button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <HelperText type="info" visible style={styles.error}>{message}</HelperText>;
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  label: { fontSize: 13, fontWeight: '500', fontFamily: fontFamilies.medium },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
  choice: { margin: 2 },
  button: { borderRadius: 14, marginTop: 8 },
  buttonContent: { paddingVertical: 6 },
  error: { color: undefined },
});
