import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * A group invite opened without an account. It is kept on this phone so that, right after signing in or creating
 * the account, the app goes back to the invite instead of asking for the link again. Only the code is kept, for a day.
 */
const KEY = 'awayday-convite-pendente-v1';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

type Stored = { code: string; savedAt: number };

function isStored(value: unknown): value is Stored {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Stored).code === 'string' &&
    typeof (value as Stored).savedAt === 'number'
  );
}

export async function savePendingInvite(code: string, now = Date.now()): Promise<void> {
  const stored: Stored = { code, savedAt: now };
  await AsyncStorage.setItem(KEY, JSON.stringify(stored)).catch(() => undefined);
}

export async function clearPendingInvite(): Promise<void> {
  await AsyncStorage.removeItem(KEY).catch(() => undefined);
}

/** Returns the pending invite code, if there is a recent one, and forgets it. */
export async function takePendingInvite(now = Date.now()): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(KEY);
    const value: unknown = JSON.parse(raw);
    return isStored(value) && now - value.savedAt <= MAX_AGE_MS ? value.code : null;
  } catch {
    return null;
  }
}
