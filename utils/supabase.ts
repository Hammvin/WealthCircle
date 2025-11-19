import { Database } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// Custom storage adapter for Expo SecureStore
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    return SecureStore.deleteItemAsync(key);
  },
};

// Safe environment variable handling with fallbacks
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://cpofqrfhkrpuuipfnslh.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwb2ZxcmZoa3JwdXVpcGZuc2xoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2ODkyMDksImV4cCI6MjA3NzI2NTIwOX0.6Zd-2HyBKmT9KLcYj7cHVlAyTZt8sGEvsTsdEFx3LPc';

// Validate environment variables
if (!supabaseUrl || supabaseUrl === 'https://cpofqrfhkrpuuipfnslh.supabase.co') {
  console.warn('Supabase URL is not configured. Please set EXPO_PUBLIC_SUPABASE_URL in your .env file');
}

if (!supabaseAnonKey || supabaseAnonKey === 'your-anon-key-here') {
  console.warn('Supabase Anon Key is not configured. Please set EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: ExpoSecureStoreAdapter,
    flowType: 'pkce',
  },
  global: {
    headers: {
      'x-application-name': 'wealthcircle-mobile',
    },
  },
});

// Auth state change listener for real-time updates and security
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event);
  
  // Handle specific auth events
  switch (event) {
    case 'SIGNED_IN':
      console.log('User signed in successfully');
      break;
    case 'SIGNED_OUT':
      console.log('User signed out');
      // Clear any sensitive data from secure storage
      SecureStore.deleteItemAsync('user_pin_set').catch(console.error);
      break;
    case 'TOKEN_REFRESHED':
      console.log('Token refreshed');
      break;
    case 'USER_UPDATED':
      console.log('User updated');
      break;
  }
});

/**
 * Enhanced database error handling with better logging and security
 */
export const handleDatabaseError = (error: any, context: string): { success: false; error: string } => {
  // Log context and safe error information
  console.error(`Database error in ${context}`);
  
  // Log safe error details (without sensitive information)
  if (error?.code) {
    console.error(`Error code: ${error.code}`);
  }
  
  // Safe error message filtering
  let userFriendlyMessage = 'Operation failed. Please try again.';
  
  if (error?.message) {
    // Filter out sensitive information from error messages
    const safeMessage = error.message
      .replace(/password/gi, '***')
      .replace(/token/gi, '***')
      .replace(/key/gi, '***')
      .replace(/secret/gi, '***');
    
    console.error(`Error message: ${safeMessage}`);
    
    // Provide user-friendly messages for common errors
    if (error.code === '23505') { // Unique violation
      userFriendlyMessage = 'This record already exists.';
    } else if (error.code === '23503') { // Foreign key violation
      userFriendlyMessage = 'Related record not found.';
    } else if (error.code === '42501') { // Insufficient privileges
      userFriendlyMessage = 'You do not have permission to perform this action.';
    } else if (error.code === '42P01') { // Table doesn't exist
      userFriendlyMessage = 'Service temporarily unavailable.';
    } else if (error.message.includes('JWT')) {
      userFriendlyMessage = 'Authentication error. Please log in again.';
    }
  }

  // Don't expose internal database errors to users
  return { success: false, error: userFriendlyMessage };
};

/**
 * Check if database tables exist and are accessible
 */
export const checkDatabaseConnection = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('chamas')
      .select('count')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" which is fine
      console.error('Database connection check failed:', error);
      return { success: false, error: 'Database connection failed' };
    }

    return { success: true };
  } catch (error) {
    console.error('Database connection check failed:', error);
    return { success: false, error: 'Database connection failed' };
  }
};

/**
 * Validate user has access to chama with enhanced security
 */
export const validateChamaAccess = async (chamaId: string, userId?: string): Promise<{ success: boolean; error?: string }> => {
  try {
    if (!chamaId) {
      return { success: false, error: 'Chama ID is required' };
    }

    // Get current user if userId not provided
    let currentUserId = userId;
    if (!currentUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      currentUserId = user?.id;
    }

    if (!currentUserId) {
      return { success: false, error: 'Authentication required' };
    }

    const { data, error } = await supabase
      .from('chama_members')
      .select('id, role')
      .eq('chama_id', chamaId)
      .eq('user_id', currentUserId)
      .single();

    if (error || !data) {
      return { success: false, error: 'Access denied to this chama' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error validating chama access:', error);
    return { success: false, error: 'Error validating access' };
  }
};

/**
 * Check if user has specific role in chama
 */
export const validateChamaRole = async (chamaId: string, requiredRole: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    const { data, error } = await supabase
      .from('chama_members')
      .select('role')
      .eq('chama_id', chamaId)
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return { success: false, error: 'Access denied' };
    }

    if (data.role !== requiredRole && data.role !== 'chairperson') {
      return { success: false, error: `Insufficient permissions. Required: ${requiredRole}` };
    }

    return { success: true };
  } catch (error) {
    console.error('Error validating chama role:', error);
    return { success: false, error: 'Error validating permissions' };
  }
};

/**
 * Safe query execution with error handling
 */
export const executeSafeQuery = async <T>(
  query: Promise<{ data: T | null; error: any }>,
  context: string
): Promise<{ success: boolean; data?: T; error?: string }> => {
  try {
    const { data, error } = await query;

    if (error) {
      return handleDatabaseError(error, context);
    }

    return { success: true, data: data as T };
  } catch (error) {
    return handleDatabaseError(error, context);
  }
};

/**
 * Initialize database connection and check health
 */
export const initializeDatabase = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    // Check auth state first
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.log('No active session - user not authenticated');
    }

    // Check database connection
    const connectionResult = await checkDatabaseConnection();
    if (!connectionResult.success) {
      return connectionResult;
    }

    console.log('Database initialized successfully');
    return { success: true };
  } catch (error) {
    console.error('Database initialization failed:', error);
    return { success: false, error: 'Database initialization failed' };
  }
};

/**
 * Secure file upload to Supabase Storage
 */
export const uploadFile = async (
  file: Blob | ArrayBuffer,
  path: string,
  bucket: string = 'wealthcircle'
): Promise<{ success: boolean; url?: string; error?: string }> => {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('File upload error:', error);
      return { success: false, error: 'Failed to upload file' };
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return { success: true, url: publicUrl };
  } catch (error) {
    console.error('File upload unexpected error:', error);
    return { success: false, error: 'File upload failed' };
  }
};

/**
 * Real-time subscription helper with error handling
 */
export const createSubscription = (
  channel: string,
  callback: (payload: any) => void,
  filters?: { [key: string]: any }
) => {
  return supabase
    .channel(channel)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        ...filters,
      },
      callback
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to ${channel}`);
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`Subscription error for ${channel}`);
      } else if (status === 'TIMED_OUT') {
        console.error(`Subscription timeout for ${channel}`);
      }
    });
};

/**
 * Batch operation helper for multiple database operations
 */
export const executeBatchOperations = async <T>(
  operations: Array<Promise<{ success: boolean; data?: T; error?: string }>>,
  context: string
): Promise<{ success: boolean; data?: T[]; errors?: string[] }> => {
  try {
    const results = await Promise.allSettled(operations);
    
    const successful: T[] = [];
    const errors: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        if (result.value.data) {
          successful.push(result.value.data);
        }
      } else {
        const error = result.status === 'fulfilled' 
          ? result.value.error 
          : `Operation ${index + 1} failed`;
        errors.push(error || 'Unknown error');
      }
    });

    if (errors.length > 0) {
      console.error(`Batch operations failed in ${context}:`, errors);
      return { 
        success: false, 
        errors 
      };
    }

    return { 
      success: true, 
      data: successful 
    };
  } catch (error) {
    console.error(`Batch operations unexpected error in ${context}:`, error);
    return { 
      success: false, 
      errors: ['Batch operations failed'] 
    };
  }
};

// Export types for better TypeScript support
export type { Database };
