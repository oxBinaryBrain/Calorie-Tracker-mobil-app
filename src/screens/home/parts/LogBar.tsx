import * as React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ActivityIndicator, IconButton, TextInput, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as ImageManipulator from 'expo-image-manipulator';
import { api } from '../../../api/client';
import { useToasts } from '../../../stores';
import { fontFamilies } from '../../../theme';
import { searchFoods, suggestionKcalHint, type FoodSuggestion } from '../../../services/foodDb';
import type { ParsedEntry } from '../../../types';

/** Persistent bottom log bar: text/photo input with food autocomplete. */
export function LogBar({ onParsed }: {
  onParsed: (parsed: ParsedEntry[], rawInput: string, photoUri?: string) => void;
}) {
  const theme = useTheme();
  const show = useToasts((s) => s.show);
  const [input, setInput] = React.useState('');
  const [suggestions, setSuggestions] = React.useState<FoodSuggestion[]>([]);
  const [parsing, setParsing] = React.useState(false);
  const [photoBusy, setPhotoBusy] = React.useState(false);

  const parseAndNavigate = React.useCallback(async (rawInput: string, photoBase64?: string, photoUri?: string) => {
    setParsing(true);
    try {
      const result = photoBase64 ? await api.parsePhoto(photoBase64) : await api.parseText(rawInput);
      const parsed: ParsedEntry[] = result.entries.map((e) => ({ ...e, type: e.type === 'exercise' ? 'exercise' : 'food' }));
      setInput('');
      setSuggestions([]);
      onParsed(parsed, rawInput, photoUri);
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not read that — try again');
    } finally {
      setParsing(false);
    }
  }, [onParsed, show]);

  const submitText = React.useCallback(() => {
    const text = input.trim();
    if (!text || parsing) return;
    void parseAndNavigate(text);
  }, [input, parsing, parseAndNavigate]);

  const openPhotoFlow = React.useCallback(async () => {
    if (photoBusy) return;
    setPhotoBusy(true);
    try {
      const ImagePicker = await import('expo-image-picker');
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        show('Camera permission is needed to photograph your plate');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false, exif: false });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      if (!manipulated.base64) {
        show('Could not read that photo — try again');
        return;
      }
      await parseAndNavigate('', manipulated.base64, manipulated.uri);
    } catch (e) {
      show(e instanceof Error ? e.message : 'Camera is unavailable right now');
    } finally {
      setPhotoBusy(false);
    }
  }, [photoBusy, parseAndNavigate, show]);

  // Autocomplete: suggest foods for the word currently being typed.
  const handleInput = React.useCallback((text: string) => {
    setInput(text);
    const word = text.match(/([a-zA-Z]{2,})\s*$/)?.[1];
    setSuggestions(word ? searchFoods(word, 4) : []);
  }, []);

  const applySuggestion = React.useCallback((sug: FoodSuggestion) => {
    setInput((prev) => prev.replace(/([a-zA-Z]{2,})\s*$/, `${sug.key} `));
    setSuggestions([]);
  }, []);

  return (
    <View style={styles.inputBarWrap}>
      <View style={styles.inputBarSlot}>
        {suggestions.length > 0 ? (
          <View style={[styles.suggestPanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
            {suggestions.map((sug, i) => (
              <Pressable
                key={sug.key}
                onPress={() => applySuggestion(sug)}
                accessibilityRole="button"
                accessibilityLabel={`Add ${sug.name}, ${suggestionKcalHint(sug.info)}`}
                style={({ pressed }) => [
                  styles.suggestRow,
                  i < suggestions.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.outlineVariant },
                  pressed && { opacity: 0.6 },
                ]}
              >
                <MaterialCommunityIcons name="food-outline" size={16} color={theme.colors.primary} />
                <Text style={[styles.suggestName, { color: theme.colors.onSurface }]}>{sug.name}</Text>
                <Text style={[styles.suggestHint, { color: theme.colors.onSurfaceVariant }]}>{suggestionKcalHint(sug.info)}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={[styles.inputBar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
        <TextInput
          value={input}
          onChangeText={handleInput}
          placeholder="Describe what you ate…"
          placeholderTextColor={theme.colors.onSurfaceVariant}
          mode="flat"
          dense
          style={styles.input}
          underlineStyle={{ height: 0 }}
          onSubmitEditing={submitText}
          returnKeyType="done"
          blurOnSubmit
          accessibilityLabel="Describe what you ate"
        />
        {parsing || photoBusy ? (
          <ActivityIndicator style={styles.inputAction} />
        ) : (
          <IconButton icon="" size={0} style={{ display: 'none' }} />
        )}
        <Pressable
          onPress={() => void openPhotoFlow()}
          style={styles.camBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Photograph your plate"
          disabled={parsing || photoBusy}
        >
          <MaterialCommunityIcons name="camera-outline" size={22} color={parsing || photoBusy ? theme.colors.outline : theme.colors.onSurfaceVariant} />
        </Pressable>
        <Pressable
          onPress={submitText}
          style={[styles.sendBtn, { backgroundColor: input.trim() ? theme.colors.primary : theme.colors.surfaceVariant }]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Log what you typed"
          disabled={!input.trim() || parsing}
        >
          <MaterialCommunityIcons name="arrow-up" size={20} color={input.trim() ? theme.colors.onPrimary : theme.colors.onSurfaceVariant} />
        </Pressable>
        </View>
      </View>
      <View
        style={[
          styles.blurBar,
          {
            borderTopColor: theme.colors.outlineVariant,
            ...(Platform.OS === 'web'
              ? {
                  backgroundColor: theme.dark ? 'rgba(33, 35, 33, 0.88)' : 'rgba(255, 255, 255, 0.88)',
                  backdropFilter: 'blur(20px) saturate(180%)',
                }
              : { backgroundColor: theme.colors.background }),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  inputBarWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  inputBarSlot: { margin: 12, marginBottom: 8, zIndex: 1, position: 'relative' },
  blurBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 28,
    borderWidth: 1,
    paddingLeft: 6,
    paddingRight: 6,
    overflow: 'hidden',
  },
  suggestPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '100%',
    marginBottom: 6,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  suggestName: { fontSize: 13.5, fontFamily: fontFamilies.medium },
  suggestHint: { fontSize: 12, marginLeft: 'auto', fontFamily: fontFamilies.regular },
  input: { flex: 1, backgroundColor: 'transparent', fontSize: 15 },
  inputAction: { marginHorizontal: 10 },
  camBtn: { padding: 8 },
  sendBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
