import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

// Push notifications through the Expo push service (free). Works in Expo Go on iOS; on Android it
// needs a development build, so registration simply does nothing there until then.

export type PushPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

// Shown as a banner even when the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let registeredToken: string | null = null;

function easProjectId(): string | null {
  const fromConfig: unknown = Constants.expoConfig?.extra?.eas?.projectId;
  const fromEas: unknown = Constants.easConfig?.projectId;
  if (typeof fromConfig === 'string') return fromConfig;
  return typeof fromEas === 'string' ? fromEas : null;
}

function canUsePush() {
  return supabase !== null && Device.isDevice && Platform.OS !== 'web' && easProjectId() !== null;
}

function toPermission(status: Notifications.PermissionStatus): PushPermission {
  if (status === Notifications.PermissionStatus.GRANTED) return 'granted';
  if (status === Notifications.PermissionStatus.DENIED) return 'denied';
  return 'undetermined';
}

/** The current permission, without asking. */
export async function pushPermission(): Promise<PushPermission> {
  if (!canUsePush()) return 'unavailable';
  const { status } = await Notifications.getPermissionsAsync();
  return toPermission(status);
}

/** Saves this phone's push token for the signed-in user. Only works if permission was already given. */
export async function registerThisDevice() {
  const projectId = easProjectId();
  if (!supabase || !canUsePush() || !projectId) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== Notifications.PermissionStatus.GRANTED) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'AwayDay',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await supabase.rpc('register_device_token', {
    p_token: token,
    p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
  });
  if (error) throw error;
  registeredToken = token;
}

/** Asks for permission (only when the user turns suggestions on) and registers this phone. */
export async function enablePushOnThisDevice(): Promise<PushPermission> {
  if (!canUsePush()) return 'unavailable';
  const current = await Notifications.getPermissionsAsync();
  const { status } =
    current.status === Notifications.PermissionStatus.GRANTED
      ? current
      : await Notifications.requestPermissionsAsync();
  const permission = toPermission(status);
  if (permission === 'granted') await registerThisDevice();
  return permission;
}

/** Stops pushes to this phone for the current account. Call it before signing out. */
export async function unregisterThisDevice() {
  if (!supabase || !registeredToken) return;
  await supabase.from('device_token').delete().eq('token', registeredToken);
  registeredToken = null;
}
