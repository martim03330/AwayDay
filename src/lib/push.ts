import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

// Push notifications through the Expo push service (free). No SDK 53 para a frente, o Expo Go **no Android** já não
// recebe notificações push: é preciso uma development build. No iOS continua a funcionar no Expo Go. Onde não dá,
// o registo não faz nada — a app não fica à espera nem mostra erros.

export type PushPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

/** Chat messages (a group's or a car's). With the app open the app shows its own small banner instead. */
export function eMensagemDeConversa(dados: unknown) {
  const tipo = typeof dados === 'object' && dados !== null ? Reflect.get(dados, 'type') : null;
  return tipo === 'grupo' || tipo === 'conversa';
}

// Shown as a banner even when the app is open, except chat messages: those get the app's own banner
// (`BannerDeMensagem`), smaller, and not when that chat is already open.
Notifications.setNotificationHandler({
  handleNotification: async (notificacao) => {
    const conversa = eMensagemDeConversa(notificacao.request.content.data);
    return {
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: !conversa,
      shouldShowList: true,
    };
  },
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
  // Registered again for this account: a removal still pending from an earlier sign-out no longer applies.
  await AsyncStorage.removeItem(CHAVE_TOKEN_POR_ESQUECER).catch(() => undefined);
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

// A token whose removal failed (signed out offline): tried again on the next launch, no session needed.
const CHAVE_TOKEN_POR_ESQUECER = 'awayday:push:token-por-esquecer';

/** This phone's push token: the one registered in this launch, or asked again from the system. */
async function tokenDesteTelemovel() {
  if (registeredToken) return registeredToken;
  const projectId = easProjectId();
  if (!canUsePush() || !projectId) return null;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== Notifications.PermissionStatus.GRANTED) return null;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data;
}

/**
 * Stops pushes to this phone for the account that is leaving. Call it before signing out. Never throws: if the
 * server cannot be reached, the token is kept and forgotten on the next launch (`forgetPendingDeviceToken`).
 */
export async function unregisterThisDevice() {
  if (!supabase) return;
  const token = await tokenDesteTelemovel().catch(() => null);
  registeredToken = null;
  if (!token) return;
  const { error } = await supabase.rpc('forget_device_token', { p_token: token });
  if (error) await AsyncStorage.setItem(CHAVE_TOKEN_POR_ESQUECER, token).catch(() => undefined);
}

/** On launch: forgets a token whose removal failed at the last sign-out. */
export async function forgetPendingDeviceToken() {
  if (!supabase) return;
  const token = await AsyncStorage.getItem(CHAVE_TOKEN_POR_ESQUECER).catch(() => null);
  if (!token) return;
  const { error } = await supabase.rpc('forget_device_token', { p_token: token });
  if (!error) await AsyncStorage.removeItem(CHAVE_TOKEN_POR_ESQUECER).catch(() => undefined);
}

/**
 * Asks for notification permission (once) and registers this phone, for rides: a driver must hear about seat
 * requests and a passenger about answers the moment they happen. Resolves with the permission.
 */
export async function ativarNotificacoesDeBoleias(): Promise<PushPermission> {
  if (!canUsePush()) return 'unavailable';
  const atual = await Notifications.getPermissionsAsync();
  const final =
    atual.status === Notifications.PermissionStatus.GRANTED
      ? atual
      : await Notifications.requestPermissionsAsync();
  if (final.status === Notifications.PermissionStatus.GRANTED) await registerThisDevice();
  return toPermission(final.status);
}

// «Ligar avisos» in the introduction, without an account: there is no one to register the phone for yet, so the
// choice waits here and the permission is asked on the first sign-in.
const CHAVE_PEDIR_AO_ENTRAR = 'awayday:push:pedir-ao-entrar';

export async function askForPushOnSignIn() {
  await AsyncStorage.setItem(CHAVE_PEDIR_AO_ENTRAR, '1');
}

/** True (once) when the person asked for notifications before having an account. */
export async function takePushAskOnSignIn(): Promise<boolean> {
  const valor = await AsyncStorage.getItem(CHAVE_PEDIR_AO_ENTRAR);
  if (valor === null) return false;
  await AsyncStorage.removeItem(CHAVE_PEDIR_AO_ENTRAR);
  return true;
}
