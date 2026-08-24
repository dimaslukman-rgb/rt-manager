import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

const storage: SupportedStorage = Platform.OS === 'web' && typeof window === 'undefined'
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

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabasePublishableKey || 'placeholder-publishable-key',
  {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
