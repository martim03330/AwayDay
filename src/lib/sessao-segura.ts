import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { juntarPedacos, partirEmPedacos } from '@/lib/pedacos';

/** Under the 2 KB some Android devices allow per value. */
const TAMANHO_DO_PEDACO = 1800;

/** Only on this phone, after it was unlocked once: never in iCloud or device backups. */
const OPCOES: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

const chaveDaContagem = (chave: string) => `${chave}.pedacos`;
const chaveDoPedaco = (chave: string, indice: number) => `${chave}.${indice}`;

async function apagarPedacos(chave: string, desde: number) {
  const guardado = await SecureStore.getItemAsync(chaveDaContagem(chave), OPCOES);
  const contagem = guardado ? Number(guardado) : 0;
  for (let indice = desde; indice < contagem; indice += 1) {
    await SecureStore.deleteItemAsync(chaveDoPedaco(chave, indice), OPCOES);
  }
}

async function guardar(chave: string, valor: string) {
  const pedacos = partirEmPedacos(valor, TAMANHO_DO_PEDACO);
  await apagarPedacos(chave, pedacos.length);
  for (const [indice, pedaco] of pedacos.entries()) {
    await SecureStore.setItemAsync(chaveDoPedaco(chave, indice), pedaco, OPCOES);
  }
  await SecureStore.setItemAsync(chaveDaContagem(chave), String(pedacos.length), OPCOES);
}

/**
 * Where Supabase keeps the session (with its long-lived refresh token): the phone's Keychain / Keystore, encrypted,
 * instead of AsyncStorage, which is plain files that also go into backups. A session left in AsyncStorage by an older
 * version moves here the first time it is read, so nobody is signed out by the update.
 */
export const sessaoSegura = {
  async getItem(chave: string): Promise<string | null> {
    const contagem = await SecureStore.getItemAsync(chaveDaContagem(chave), OPCOES);
    if (contagem !== null) {
      const indices = Array.from({ length: Number(contagem) }, (_, indice) => indice);
      const pedacos = await Promise.all(
        indices.map((indice) => SecureStore.getItemAsync(chaveDoPedaco(chave, indice), OPCOES))
      );
      return juntarPedacos(pedacos);
    }
    const antigo = await AsyncStorage.getItem(chave);
    if (antigo !== null) {
      await guardar(chave, antigo);
      await AsyncStorage.removeItem(chave);
    }
    return antigo;
  },

  async setItem(chave: string, valor: string): Promise<void> {
    await guardar(chave, valor);
  },

  async removeItem(chave: string): Promise<void> {
    await apagarPedacos(chave, 0);
    await SecureStore.deleteItemAsync(chaveDaContagem(chave), OPCOES);
    await AsyncStorage.removeItem(chave);
  },
};
