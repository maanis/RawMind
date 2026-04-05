import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeAsync } from '@/utils/safe';

export async function getStorageItem(
  key: string,
  fallback: string | null = null,
): Promise<string | null> {
  return (
    (await safeAsync(
      async () => {
        const value = await AsyncStorage.getItem(key);
        return typeof value === 'string' ? value : fallback;
      },
      { context: `AsyncStorage.getItem failed for ${key}`, fallback },
    )) ?? fallback
  );
}

export async function setStorageItem(key: string, value: string | null): Promise<boolean> {
  return (
    (await safeAsync(
      async () => {
        if (value === null) {
          await AsyncStorage.removeItem(key);
          return true;
        }

        await AsyncStorage.setItem(key, value);
        return true;
      },
      { context: `AsyncStorage.setItem failed for ${key}`, fallback: false },
    )) ?? false
  );
}

export async function removeStorageItem(key: string): Promise<boolean> {
  return (
    (await safeAsync(
      async () => {
        await AsyncStorage.removeItem(key);
        return true;
      },
      { context: `AsyncStorage.removeItem failed for ${key}`, fallback: false },
    )) ?? false
  );
}

export async function setStorageEntries(entries: Array<[string, string]>): Promise<boolean> {
  return (
    (await safeAsync(
      async () => {
        if (entries.length === 0) {
          return true;
        }

        await AsyncStorage.multiSet(entries);
        return true;
      },
      { context: 'AsyncStorage.multiSet failed', fallback: false },
    )) ?? false
  );
}
