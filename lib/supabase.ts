import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://isevxhsggwatxicxniqn.supabase.co';

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_Ut4oSTSC0nNfu8hFcCFoGw_ekUklVip';

export const isSupabaseConfigured = true;

const storage: SupportedStorage =
  Platform.OS === 'web' && typeof window === 'undefined'
    ? {
        getItem: async () => null,
        setItem: async () => undefined,
        removeItem: async () => undefined,
      }
    : Platform.OS === 'web'
    ? {
        getItem: async (key) => window.localStorage.getItem(key),
        setItem: async (key, value) => window.localStorage.setItem(key, value),
        removeItem: async (key) => window.localStorage.removeItem(key),
      }
    : AsyncStorage;

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
