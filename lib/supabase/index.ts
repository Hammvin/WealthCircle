import { Database } from '@/types/supabase';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// Enhanced environment validation - NO hardcoded fallbacks
const validateEnvironment = (): { url: string; key: string } => {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are not configured');
  }

  // Security: Validate URL format
  if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
    throw new Error('Invalid Supabase URL format');
  }

  return { url: supabaseUrl, key: supabaseAnonKey };
};

// Secure storage adapter
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

// Get validated environment variables
const { url: supabaseUrl, key: supabaseAnonKey } = validateEnvironment();

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: ExpoSecureStoreAdapter,
    flowType: 'pkce',
  },
});

// Re-export security utilities
export { executeSafeQuery, handleDatabaseError, Security, validateChamaAccess } from './security';
export type { Database };

