import { Database } from '@/types/supabase';
import { createClient } from '@supabase/supabase-js';

// Enhanced environment validation
const getEnvVariables = () => {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please check your .env file'
    );
  }

  return { supabaseUrl, supabaseAnonKey };
};

const { supabaseUrl, supabaseAnonKey } = getEnvVariables();

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// Enhanced error handling
export const handleSupabaseError = (error: any, context: string) => {
  console.error(`Supabase error in ${context}:`, error);
  
  let userMessage = 'An error occurred. Please try again.';
  
  if (error?.code === '42501') {
    userMessage = 'You do not have permission to perform this action.';
  } else if (error?.message?.includes('JWT')) {
    userMessage = 'Authentication error. Please log in again.';
  } else if (error?.message?.includes('network')) {
    userMessage = 'Network error. Please check your connection.';
  }
  
  return { success: false, error: userMessage };
};