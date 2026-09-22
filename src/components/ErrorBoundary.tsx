import * as React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/**
 * Catches render crashes under the navigator so one broken screen shows a
 * calm recovery view instead of a white screen. Reload restarts the app tree.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.warn('Caloria screen error:', error);
  }

  private reload = () => {
    if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
      window.location.reload();
    } else {
      this.setState({ error: null });
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    return <ErrorFallback onReload={this.reload} />;
  }
}

function ErrorFallback({ onReload }: { onReload: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: theme.colors.background }]}>
      <MaterialCommunityIcons name="alert-circle-outline" size={40} color={theme.colors.onSurfaceVariant} />
      <Text style={[styles.title, { color: theme.colors.onSurface }]}>Something went wrong</Text>
      <Text style={[styles.body, { color: theme.colors.onSurfaceVariant }]}>
        This screen could not load. Reloading usually fixes it.
      </Text>
      <Pressable
        onPress={onReload}
        accessibilityRole="button"
        accessibilityLabel="Reload the app"
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.colors.primary, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={[styles.buttonText, { color: theme.colors.onPrimary }]}>Reload</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontSize: 17, fontWeight: '600', marginTop: 4 },
  body: { fontSize: 13.5, textAlign: 'center', maxWidth: 280, lineHeight: 20 },
  button: { marginTop: 12, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14 },
  buttonText: { fontSize: 15, fontWeight: '600' },
});
