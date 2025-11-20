[file name]: supabase.ts
[file content begin]
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Database } from './database.types';

// Security Configuration
const SECURITY_CONFIG = {
  SESSION_TIMEOUT: 7 * 24 * 60 * 60 * 1000, // 7 days
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  MAX_RATE_LIMIT_ATTEMPTS: 5,
} as const;

// Kenyan Phone Number Utilities
export const KenyanPhoneUtils = {
  /**
   * Validate all Kenyan phone number formats
   * Accepted formats:
   * - +254713618045 (International)
   * - 0713618045 (Local with leading 0)
   * - 0113618045 (Landline with leading 0)
   */
  validate: (phone: string): boolean => {
    const cleanPhone = phone.replace(/\s+/g, '');
    
    // Kenyan phone number regex patterns
    const patterns = {
      // International format: +254 followed by 9 digits
      international: /^\+254[17]\d{8}$/,
      
      // Mobile local format: 07 followed by 8 digits
      mobileLocal: /^07[17]\d{7}$/,
      
      // Landline local format: 0 followed by 2-4 digits (area code) and 5-7 digits
      landlineLocal: /^0[1-9]\d{6,8}$/,
      
      // Safaricom format specifically (071, 070, 072, 079, 075, 076, 074)
      safaricom: /^0(71|70|72|79|75|76|74)\d{7}$/,
      
      // Airtel format (073, 075, 076, 078, 079)
      airtel: /^0(73|75|76|78|79)\d{7}$/,
      
      // Telkom format (077)
      telkom: /^077\d{7}$/,
    };

    return (
      patterns.international.test(cleanPhone) ||
      patterns.mobileLocal.test(cleanPhone) ||
      patterns.landlineLocal.test(cleanPhone) ||
      patterns.safaricom.test(cleanPhone) ||
      patterns.airtel.test(cleanPhone) ||
      patterns.telkom.test(cleanPhone)
    );
  },

  /**
   * Normalize Kenyan phone number to international format (+254...)
   */
  normalizeToInternational: (phone: string): string => {
    const cleanPhone = phone.replace(/\s+/g, '');
    
    // If already in international format, return as-is
    if (cleanPhone.startsWith('+254')) {
      return cleanPhone;
    }
    
    // If starts with 0, replace with +254
    if (cleanPhone.startsWith('0')) {
      return '+254' + cleanPhone.substring(1);
    }
    
    // If no prefix, assume it's missing +254
    if (/^[17]/.test(cleanPhone)) {
      return '+254' + cleanPhone;
    }
    
    // Return original if we can't normalize
    return cleanPhone;
  },

  /**
   * Format phone number for display (0713 618 045)
   */
  formatForDisplay: (phone: string): string => {
    const normalized = KenyanPhoneUtils.normalizeToInternational(phone);
    
    if (normalized.startsWith('+254')) {
      const digits = normalized.substring(4); // Remove +254
      if (digits.length === 9) {
        return `0${digits.substring(0, 2)} ${digits.substring(2, 5)} ${digits.substring(5)}`;
      }
    }
    
    return phone; // Return original if formatting fails
  },

  /**
   * Extract carrier information from phone number
   */
  getCarrier: (phone: string): string => {
    const cleanPhone = KenyanPhoneUtils.normalizeToInternational(phone);
    const prefix = cleanPhone.substring(4, 6); // Get digits after +254
    
    const carriers: { [key: string]: string } = {
      '70': 'Safaricom',
      '71': 'Safaricom',
      '72': 'Safaricom',
      '74': 'Safaricom',
      '75': 'Airtel', // Also used by Safaricom
      '76': 'Airtel', // Also used by Safaricom
      '77': 'Telkom',
      '78': 'Airtel',
      '79': 'Safaricom', // Also used by Airtel
      '11': 'Landline', // Nairobi landlines
      '20': 'Landline', // Eldoret
      '40': 'Landline', // Mombasa
      '50': 'Landline', // Kakamega
      '60': 'Landline', // Meru
    };
    
    return carriers[prefix] || 'Unknown';
  },

  /**
   * Check if number is a mobile number (not landline)
   */
  isMobile: (phone: string): boolean => {
    const cleanPhone = phone.replace(/\s+/g, '');
    const mobilePrefixes = ['07', '+2547'];
    
    return mobilePrefixes.some(prefix => cleanPhone.startsWith(prefix));
  },

  /**
   * Validate phone number with detailed error messages
   */
  validateWithDetails: (phone: string): { isValid: boolean; error?: string; normalized?: string } => {
    if (!phone || phone.trim().length === 0) {
      return { isValid: false, error: 'Phone number is required' };
    }

    const cleanPhone = phone.replace(/\s+/g, '');
    
    if (cleanPhone.length < 9) {
      return { isValid: false, error: 'Phone number is too short' };
    }

    if (cleanPhone.length > 13) {
      return { isValid: false, error: 'Phone number is too long' };
    }

    if (!KenyanPhoneUtils.validate(cleanPhone)) {
      return { 
        isValid: false, 
        error: 'Invalid Kenyan phone number format. Use formats: 0712345678 or +254712345678' 
      };
    }

    const normalized = KenyanPhoneUtils.normalizeToInternational(cleanPhone);
    
    return { 
      isValid: true, 
      normalized,
      error: undefined 
    };
  },
};

// Custom secure storage adapter with enhanced security
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const encryptedValue = await SecureStore.getItemAsync(key);
      if (!encryptedValue) return null;
      
      // In production, add decryption logic here
      return encryptedValue;
    } catch (error) {
      console.error('SecureStore get error:', error);
      await SecurityLogger.log('SECURE_STORE_GET_FAILED', { key, error: error.message });
      return null;
    }
  },
  
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      // Add encryption in production
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error('SecureStore set error:', error);
      await SecurityLogger.log('SECURE_STORE_SET_FAILED', { key, error: error.message });
      throw new Error('Failed to store secure data');
    }
  },
  
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('SecureStore remove error:', error);
      await SecurityLogger.log('SECURE_STORE_REMOVE_FAILED', { key, error: error.message });
    }
  },
};

// Enhanced environment validation
const validateEnvironment = (): { url: string; key: string } => {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  // Security: Comprehensive environment validation
  if (!supabaseUrl || !supabaseAnonKey) {
    const error = 'Supabase environment variables are not configured';
    SecurityLogger.log('ENV_VALIDATION_FAILED', { error });
    throw new Error(error);
  }

  // Security: Validate URL format
  if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
    const error = 'Invalid Supabase URL format';
    SecurityLogger.log('ENV_VALIDATION_FAILED', { error, url: supabaseUrl });
    throw new Error(error);
  }

  // Security: Validate key format (basic JWT format check)
  if (!supabaseAnonKey.includes('.') || supabaseAnonKey.length < 50) {
    const error = 'Invalid Supabase key format';
    SecurityLogger.log('ENV_VALIDATION_FAILED', { error });
    throw new Error(error);
  }

  return { url: supabaseUrl, key: supabaseAnonKey };
};

// Security Logger for audit trails
const SecurityLogger = {
  log: async (event: string, metadata: any = {}) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
      event,
      timestamp,
      metadata: SecurityLogger.sanitizeMetadata(metadata),
      appVersion: '1.0.0',
      platform: 'mobile',
    };

    if (__DEV__) {
      console.log(`[SECURITY] ${event}:`, logEntry);
    }

    // In production, send to secure logging service
    try {
      await supabase
        .from('security_logs')
        .insert([logEntry])
        .then(({ error }) => {
          if (error) {
            console.error('Failed to log security event:', error);
          }
        });
    } catch (error) {
      console.error('Security logging failed:', error);
    }
  },

  sanitizeMetadata: (metadata: any): any => {
    const sanitized = { ...metadata };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'pin', 'ssn'];
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '***';
      }
    });

    // Sanitize phone numbers in metadata
    if (sanitized.phone) {
      sanitized.phone = sanitized.phone.replace(/(\d{3})\d+(\d{3})/, '$1***$2');
    }

    return sanitized;
  },
};

// Get validated environment variables
const { url: supabaseUrl, key: supabaseAnonKey } = validateEnvironment();

// Create Supabase client with enhanced security configuration
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: ExpoSecureStoreAdapter,
    flowType: 'pkce',
    debug: __DEV__,
  },
  global: {
    headers: {
      'x-application-name': 'wealthcircle-mobile',
      'x-app-version': '1.0.0',
      'x-platform': 'react-native',
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 10, // Rate limiting for real-time
    },
  },
});

// Security: Session management with automatic timeout
let sessionTimeout: NodeJS.Timeout;

const resetSessionTimeout = () => {
  if (sessionTimeout) clearTimeout(sessionTimeout);
  
  sessionTimeout = setTimeout(async () => {
    console.log('Session timeout - signing out user for security');
    await SecurityLogger.log('SESSION_TIMEOUT');
    await supabase.auth.signOut();
  }, SECURITY_CONFIG.SESSION_TIMEOUT);
};

// Enhanced auth state change listener with security monitoring
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('Auth state changed:', event);
  
  // Security: Reset session timeout on auth activity
  if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    resetSessionTimeout();
  }
  
  // Security: Handle specific auth events
  switch (event) {
    case 'SIGNED_IN':
      console.log('User signed in successfully');
      await SecurityLogger.log('USER_SIGNED_IN', { 
        userId: session?.user?.id,
        loginMethod: 'phone'
      });
      break;
      
    case 'SIGNED_OUT':
      console.log('User signed out');
      if (sessionTimeout) clearTimeout(sessionTimeout);
      await clearSensitiveData();
      await SecurityLogger.log('USER_SIGNED_OUT');
      break;
      
    case 'TOKEN_REFRESHED':
      console.log('Token refreshed');
      await SecurityLogger.log('TOKEN_REFRESHED');
      break;
      
    case 'USER_UPDATED':
      console.log('User updated');
      await SecurityLogger.log('USER_UPDATED');
      break;
      
    case 'USER_DELETED':
      console.log('User deleted');
      await clearSensitiveData();
      await SecurityLogger.log('USER_DELETED');
      break;
      
    case 'PASSWORD_RECOVERY':
      console.log('Password recovery initiated');
      await SecurityLogger.log('PASSWORD_RECOVERY_INITIATED');
      break;
  }
});

// Security: Enhanced error handling with classification
export class SecurityError extends Error {
  constructor(
    message: string,
    public category: 'AUTH' | 'NETWORK' | 'VALIDATION' | 'DATABASE' | 'UNKNOWN',
    public userFriendly: boolean = true
  ) {
    super(message);
    this.name = 'SecurityError';
  }
}

export const handleDatabaseError = (error: any, context: string): { success: false; error: string } => {
  // Security: Classify and sanitize errors
  let securityCategory: 'AUTH' | 'NETWORK' | 'VALIDATION' | 'DATABASE' | 'UNKNOWN' = 'UNKNOWN';
  let userFriendlyMessage = 'Operation failed. Please try again.';
  let shouldLog = true;
  let securityLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

  // Security: Error classification
  if (error?.code?.startsWith('23')) {
    securityCategory = 'DATABASE';
    userFriendlyMessage = 'Data integrity error occurred.';
  } else if (error?.code === '42501') {
    securityCategory = 'AUTH';
    userFriendlyMessage = 'You do not have permission to perform this action.';
    shouldLog = false;
    securityLevel = 'MEDIUM';
  } else if (error?.message?.includes('JWT') || error?.code === '401') {
    securityCategory = 'AUTH';
    userFriendlyMessage = 'Authentication error. Please log in again.';
    shouldLog = false;
    securityLevel = 'HIGH';
  } else if (error?.message?.includes('network') || error?.code === 'ECONNREFUSED') {
    securityCategory = 'NETWORK';
    userFriendlyMessage = 'Network error. Please check your connection.';
  } else if (error?.code === 'PGRST301' || error?.code === 'PGRST302') {
    securityCategory = 'AUTH';
    userFriendlyMessage = 'Access denied.';
    securityLevel = 'MEDIUM';
  }

  // Security: Safe logging (no sensitive data)
  if (shouldLog) {
    SecurityLogger.log(`DATABASE_ERROR_${securityCategory}`, {
      context,
      code: error?.code,
      message: error?.message ? sanitizeErrorMessage(error.message) : 'No message',
      securityLevel,
      category: securityCategory
    });
  }

  return { success: false, error: userFriendlyMessage };
};

// Security: Input validation and sanitization
export const validateInput = {
  phone: (phone: string): { isValid: boolean; error?: string; normalized?: string } => {
    return KenyanPhoneUtils.validateWithDetails(phone);
  },
  
  phoneSimple: (phone: string): boolean => {
    return KenyanPhoneUtils.validate(phone);
  },
  
  email: (email: string): { isValid: boolean; error?: string } => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(email);
    
    return {
      isValid,
      error: isValid ? undefined : 'Please enter a valid email address'
    };
  },
  
  amount: (amount: number): { isValid: boolean; error?: string } => {
    const isValid = amount > 0 && amount <= 1000000; // KSh 1M limit
    
    return {
      isValid,
      error: isValid ? undefined : amount <= 0 ? 'Amount must be positive' : 'Amount exceeds maximum limit'
    };
  },
  
  chamaName: (name: string): { isValid: boolean; error?: string } => {
    const isValid = name.length >= 2 && name.length <= 100;
    
    return {
      isValid,
      error: isValid ? undefined : 
        name.length < 2 ? 'Chama name must be at least 2 characters' : 
        'Chama name is too long'
    };
  },
  
  pin: (pin: string): { isValid: boolean; error?: string } => {
    const isValid = /^\d{4}$/.test(pin);
    
    return {
      isValid,
      error: isValid ? undefined : 'PIN must be exactly 4 digits'
    };
  },
};

// Security: Rate limiting implementation
const rateLimitStore = new Map<string, { count: number; lastAttempt: number; blockedUntil?: number }>();

export const checkRateLimit = (
  identifier: string, 
  action: string, 
  maxAttempts: number = SECURITY_CONFIG.MAX_RATE_LIMIT_ATTEMPTS, 
  windowMs: number = SECURITY_CONFIG.RATE_LIMIT_WINDOW
): { allowed: boolean; retryAfter?: number; attemptsLeft?: number } => {
  const key = `${identifier}:${action}`;
  const now = Date.now();
  const record = rateLimitStore.get(key);

  // Check if currently blocked
  if (record?.blockedUntil && now < record.blockedUntil) {
    return { 
      allowed: false, 
      retryAfter: Math.ceil((record.blockedUntil - now) / 1000) 
    };
  }

  // Reset if window has passed or no record exists
  if (!record || (now - record.lastAttempt > windowMs)) {
    rateLimitStore.set(key, { count: 1, lastAttempt: now });
    return { allowed: true, attemptsLeft: maxAttempts - 1 };
  }

  // Check if exceeded limit
  if (record.count >= maxAttempts) {
    // Block for 15 minutes
    const blockedUntil = now + (15 * 60 * 1000);
    rateLimitStore.set(key, { ...record, blockedUntil });
    
    SecurityLogger.log('RATE_LIMIT_EXCEEDED', { identifier, action, attempts: record.count });
    
    return { 
      allowed: false, 
      retryAfter: 900 // 15 minutes in seconds
    };
  }

  // Increment count
  record.count++;
  record.lastAttempt = now;
  
  return { 
    allowed: true, 
    attemptsLeft: maxAttempts - record.count 
  };
};

// Security: Data sanitization utilities
const sanitizeErrorMessage = (message: string): string => {
  return message
    .replace(/password=['"][^'"]*['"]/gi, 'password=***')
    .replace(/token=['"][^'"]*['"]/gi, 'token=***')
    .replace(/key=['"][^'"]*['"]/gi, 'key=***')
    .replace(/secret=['"][^'"]*['"]/gi, 'secret=***')
    .replace(/([0-9]{3})[0-9]+([0-9]{3})/g, '$1****$2') // Mask phone numbers
    .replace(/\b\d{4}\b/g, '****'); // Mask 4-digit numbers (PINs)
};

const clearSensitiveData = async (): Promise<void> => {
  const sensitiveKeys = [
    'user_pin_set', 
    'biometric_enabled', 
    'last_login',
    'auth_token',
    'user_session'
  ];
  
  for (const key of sensitiveKeys) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error(`Failed to clear sensitive data for key: ${key}`, error);
    }
  }
  
  SecurityLogger.log('SENSITIVE_DATA_CLEARED');
};

// Security: Enhanced database operations with retry logic
export const executeSecureQuery = async <T>(
  query: Promise<{ data: T | null; error: any }>,
  context: string,
  retryCount: number = 0
): Promise<{ success: boolean; data?: T; error?: string }> => {
  try {
    const { data, error } = await query;

    if (error) {
      // Security: Retry on network errors
      if (error.message?.includes('network') && retryCount < SECURITY_CONFIG.MAX_RETRY_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, SECURITY_CONFIG.RETRY_DELAY * (retryCount + 1)));
        return executeSecureQuery(query, context, retryCount + 1);
      }
      
      return handleDatabaseError(error, context);
    }

    return { success: true, data: data as T };
  } catch (error) {
    return handleDatabaseError(error, context);
  }
};

// Security: Initialize and health check
export const initializeSecureDatabase = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    // Check auth state
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      resetSessionTimeout();
      await SecurityLogger.log('SESSION_RESTORED', { userId: session.user.id });
    }

    // Security: Test database connection with timeout using database types
    const connectionPromise = supabase
      .from('chamas')
      .select('id')
      .limit(1)
      .maybeSingle();

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), 10000)
    );

    const { error } = await Promise.race([connectionPromise, timeoutPromise]) as any;

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" which is fine
      await SecurityLogger.log('DATABASE_CONNECTION_FAILED', { error: error.message });
      return { success: false, error: 'Database connection failed' };
    }

    await SecurityLogger.log('DATABASE_INITIALIZED_SUCCESS');
    return { success: true };
  } catch (error: any) {
    await SecurityLogger.log('DATABASE_INITIALIZATION_FAILED', { error: error.message });
    return { success: false, error: 'Database initialization failed' };
  }
};

// Security: User permission validation using database types
export const validateUserPermissions = async (
  chamaId: string, 
  requiredRole?: Database['public']['Enums']['member_role']
): Promise<{ success: boolean; error?: string; role?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    const { data: membership, error } = await supabase
      .from('chama_members')
      .select('role')
      .eq('chama_id', chamaId)
      .eq('user_id', user.id)
      .single();

    if (error || !membership) {
      await SecurityLogger.log('PERMISSION_DENIED', { 
        userId: user.id, 
        chamaId, 
        reason: 'Not a member' 
      });
      return { success: false, error: 'Access denied to this chama' };
    }

    // Check specific role requirement using database enum types
    if (requiredRole && membership.role !== requiredRole && membership.role !== 'chairperson') {
      await SecurityLogger.log('INSUFFICIENT_PERMISSIONS', { 
        userId: user.id, 
        chamaId, 
        userRole: membership.role, 
        requiredRole 
      });
      return { 
        success: false, 
        error: `Insufficient permissions. Required: ${requiredRole}` 
      };
    }

    return { success: true, role: membership.role };
  } catch (error: any) {
    await SecurityLogger.log('PERMISSION_VALIDATION_ERROR', { error: error.message });
    return { success: false, error: 'Error validating permissions' };
  }
};

// Enhanced database operations with proper typing
export const DatabaseOperations = {
  // Chama operations
  chamas: {
    getById: async (chamaId: string) => {
      return executeSecureQuery(
        supabase
        .from('chamas')
          .select('*')
          .eq('id', chamaId)
          .single(),
        'GET_CHAMA_BY_ID'
      );
    },
    
    getUserChamas: async (userId: string) => {
      return executeSecureQuery(
        supabase
          .from('chama_members')
          .select(`
            chama:chamas (
              id,
              name,
              description,
              created_at,
              contribution_amount,
              contribution_frequency
            ),
            role
          `)
          .eq('user_id', userId),
        'GET_USER_CHAMAS'
      );
    },
    
    create: async (chamaData: Database['public']['Tables']['chamas']['Insert']) => {
      return executeSecureQuery(
        supabase
          .from('chamas')
          .insert([chamaData])
          .select()
          .single(),
        'CREATE_CHAMA'
      );
    },
  },
  
  // Member operations
  members: {
    addToChama: async (memberData: Database['public']['Tables']['chama_members']['Insert']) => {
      return executeSecureQuery(
        supabase
          .from('chama_members')
          .insert([memberData])
          .select()
          .single(),
        'ADD_MEMBER_TO_CHAMA'
      );
    },
    
    getChamaMembers: async (chamaId: string) => {
      return executeSecureQuery(
        supabase
          .from('chama_members')
          .select(`
            id,
            role,
            joined_at,
            user:users (
              id,
              phone,
              full_name,
              avatar_url
            )
          `)
          .eq('chama_id', chamaId),
        'GET_CHAMA_MEMBERS'
      );
    },
    
    updateRole: async (memberId: string, role: Database['public']['Enums']['member_role']) => {
      return executeSecureQuery(
        supabase
          .from('chama_members')
          .update({ role })
          .eq('id', memberId)
          .select()
          .single(),
        'UPDATE_MEMBER_ROLE'
      );
    },
  },
  
  // Contribution operations
  contributions: {
    create: async (contributionData: Database['public']['Tables']['contributions']['Insert']) => {
      return executeSecureQuery(
        supabase
          .from('contributions')
          .insert([contributionData])
          .select()
          .single(),
        'CREATE_CONTRIBUTION'
      );
    },
    
    getChamaContributions: async (chamaId: string) => {
      return executeSecureQuery(
        supabase
          .from('contributions')
          .select(`
            *,
            member:chama_members (
              user:users (
                full_name,
                phone
              )
            )
          `)
          .eq('chama_id', chamaId)
          .order('created_at', { ascending: false }),
        'GET_CHAMA_CONTRIBUTIONS'
      );
    },
    
    getUserContributions: async (userId: string, chamaId: string) => {
      return executeSecureQuery(
        supabase
          .from('contributions')
          .select(`
            *,
            chama:chamas (
              name
            )
          `)
          .eq('chama_id', chamaId)
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        'GET_USER_CONTRIBUTIONS'
      );
    },
  },
  
  // User operations
  users: {
    getProfile: async (userId: string) => {
      return executeSecureQuery(
        supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single(),
        'GET_USER_PROFILE'
      );
    },
    
    updateProfile: async (userId: string, updates: Database['public']['Tables']['users']['Update']) => {
      return executeSecureQuery(
        supabase
          .from('users')
          .update(updates)
          .eq('id', userId)
          .select()
          .single(),
        'UPDATE_USER_PROFILE'
      );
    },
    
    searchByPhone: async (phone: string) => {
      const normalizedPhone = KenyanPhoneUtils.normalizeToInternational(phone);
      return executeSecureQuery(
        supabase
          .from('users')
          .select('id, full_name, phone, avatar_url')
          .eq('phone', normalizedPhone)
          .single(),
        'SEARCH_USER_BY_PHONE'
      );
    },
  },
};

// Export security utilities
export const Security = {
  validateInput,
  checkRateLimit,
  executeSecureQuery,
  validateUserPermissions,
  initializeSecureDatabase,
  KenyanPhoneUtils,
  logger: SecurityLogger,
  DatabaseOperations,
};

export type { Database };
[file content end]