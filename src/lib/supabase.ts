import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from '@/lib/database.types';
import { sessaoSegura } from '@/lib/sessao-segura';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Opening the project in a browser makes Expo Router render the screens in Node, where AsyncStorage has no `window`
 * and throws — and that error used to take the whole dev server down, leaving Expo Go with nothing to open. There is
 * no session to keep while rendering on a server, so it is simply left out there.
 */
const noServidor = typeof window === 'undefined';

/**
 * Supabase client with the publishable key only (RLS protects the data).
 * `null` when the environment variables are missing: the app keeps working with its bundled data,
 * signed out. The session is kept in the phone's secure storage (Keychain / Keystore) so people stay signed in
 * between launches without the refresh token lying in plain files; on the web, where there is none, in AsyncStorage.
 */
export const supabase =
  supabaseUrl && supabasePublishableKey
    ? createClient<Database>(supabaseUrl, supabasePublishableKey, {
        auth: noServidor
          ? { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
          : {
              storage: Platform.OS === 'web' ? AsyncStorage : sessaoSegura,
              persistSession: true,
              autoRefreshToken: true,
              detectSessionInUrl: false,
            },
      })
    : null;

// Refresh the session only while the app is in the foreground.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
}
