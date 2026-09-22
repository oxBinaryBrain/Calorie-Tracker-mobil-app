import { Platform } from 'react-native';

/**
 * Key-value storage abstraction: expo-secure-store on native (Keychain /
 * Keystore), AsyncStorage (localStorage) on web — SecureStore has no web
 * implementation in this SDK. Same async API everywhere.
 */

async function secure(): Promise<typeof import('expo-secure-store') | null> {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-secure-store');
  } catch {
    return null;
  }
}

async function local(): Promise<typeof import('@react-native-async-storage/async-storage')['default']> {
  const mod = await import('@react-native-async-storage/async-storage');
  return mod.default;
}

export async function storageGet(key: string): Promise<string | null> {
  const s = await secure();
  if (s) {
    try {
      return await s.getItemAsync(key);
    } catch {
      return null;
    }
  }
  try {
    return await (await local()).getItem(key);
  } catch {
    return null;
  }
}

export async function storageSet(key: string, value: string): Promise<void> {
  const s = await secure();
  if (s) {
    try {
      await s.setItemAsync(key, value);
      return;
    } catch {
      // fall through to nothing — native storage should not silently fail,
      // but stay calm rather than crash the app
    }
    return;
  }
  try {
    await (await local()).setItem(key, value);
  } catch {
    // ignore
  }
}

export async function storageDelete(key: string): Promise<void> {
  const s = await secure();
  if (s) {
    try {
      await s.deleteItemAsync(key);
    } catch {
      // ignore
    }
    return;
  }
  try {
    await (await local()).removeItem(key);
  } catch {
    // ignore
  }
}
