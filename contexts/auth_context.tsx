import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  signup: (phoneNumber: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string }>;
  signin: (phoneNumber: string, password: string) => Promise<{ success: boolean; error?: string }>;
  // NEW: OTP authentication methods migrated from auth.ts
  signInWithPhoneOTP: (phoneNumber: string) => Promise<{ success: boolean; error?: string }>;
  verifyOTP: (phoneNumber: string, token: string) => Promise<{ success: boolean; error?: string; session?: Session }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

// Security Configuration (merged from auth.ts)
const SECURITY_CONFIG = {
  MIN_PHONE_LENGTH: 10,
  MAX_PHONE_LENGTH: 15,
  MIN_NAME_LENGTH: 2,
  MAX_NAME_LENGTH: 100,
  OTP_LENGTH: 6,
  TEMP_PASSWORD_LENGTH: 12,
  RATE_LIMIT_DURATION: 15 * 60 * 1000, // 15 minutes
  MAX_ATTEMPTS_PER_WINDOW: 5,
  SHORT_RATE_LIMIT_DURATION: 2 * 60 * 1000, // 2 minutes for development
} as const;

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Secure device fingerprinting
  const getDeviceFingerprint = async (): Promise<string> => {
    try {
      const fingerprintData = [
        Platform.OS,
        Platform.Version,
        await Application.getAndroidId?.() || 'unknown',
        Application.applicationId || 'unknown',
        Date.now().toString() // Add timestamp for uniqueness
      ].join('|');
      
      return await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        fingerprintData
      );
    } catch (error) {
      // Fallback with basic fingerprint
      const basicFingerprint = [Platform.OS, Platform.Version, 'fallback'].join('|');
      return await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        basicFingerprint
      );
    }
  };

  // Secure rate limiting with cryptographic protection
  const checkRateLimit = async (identifier: string): Promise<{ allowed: boolean; timeRemaining?: number }> => {
    try {
      const deviceHash = await getDeviceFingerprint();
      const identifierHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        identifier + deviceHash
      );

      const now = Date.now();
      const rateLimitKey = `rl_${identifierHash}`; // Obfuscated key name
      
      // Use shorter limits in development, but NEVER disable
      const currentLimitDuration = __DEV__ ? SECURITY_CONFIG.SHORT_RATE_LIMIT_DURATION : SECURITY_CONFIG.RATE_LIMIT_DURATION;
      const currentMaxAttempts = __DEV__ ? 10 : SECURITY_CONFIG.MAX_ATTEMPTS_PER_WINDOW;

      const attemptsData = await SecureStore.getItemAsync(rateLimitKey);
      
      if (attemptsData) {
        const attempts: number[] = JSON.parse(attemptsData);
        const recentAttempts = attempts.filter(timestamp => 
          now - timestamp < currentLimitDuration
        );

        if (recentAttempts.length >= currentMaxAttempts) {
          const oldestAttempt = Math.min(...recentAttempts);
          const timeRemaining = currentLimitDuration - (now - oldestAttempt);
          return { allowed: false, timeRemaining };
        }

        recentAttempts.push(now);
        await SecureStore.setItemAsync(rateLimitKey, JSON.stringify(recentAttempts));
        return { allowed: true };
      } else {
        await SecureStore.setItemAsync(rateLimitKey, JSON.stringify([now]));
        return { allowed: true };
      }
    } catch (error) {
      // SECURITY: Fail secure - block on error
      return { allowed: false, timeRemaining: SECURITY_CONFIG.RATE_LIMIT_DURATION };
    }
  };

  const clearRateLimitData = async (): Promise<void> => {
    try {
      // Only clear on legitimate events (sign out), not exposed publicly
      const deviceHash = await getDeviceFingerprint();
      const keysToClear = [
        `rl_signup_${deviceHash}`,
        `rl_signin_${deviceHash}`,
        `rl_otp_${deviceHash}`,
        `rl_verify_${deviceHash}`,
      ];
      
      for (const key of keysToClear) {
        await SecureStore.deleteItemAsync(key);
      }
    } catch (error) {
      // Silent fail - security operation
    }
  };

  // DEVELOPMENT: Clear rate limits on app start (secure implementation)
  const clearDevelopmentRateLimits = async (): Promise<void> => {
    if (!__DEV__) return; // Only run in development
    
    try {
      const deviceHash = await getDeviceFingerprint();
      const developmentKeys = [
        `rl_signup_${deviceHash}`,
        `rl_signin_${deviceHash}`,
        `rl_otp_${deviceHash}`,
        `rl_verify_${deviceHash}`,
      ];
      
      let clearedCount = 0;
      for (const key of developmentKeys) {
        const existed = await SecureStore.getItemAsync(key);
        if (existed) {
          await SecureStore.deleteItemAsync(key);
          clearedCount++;
        }
      }
      
      if (clearedCount > 0) {
        console.log('🔧 Development: Cleared persistent rate limits');
      }
    } catch (error) {
      console.log('⚠️ Development: Could not clear rate limits', error);
    }
  };

  // Security utilities migrated from auth.ts
  const SecurityUtils = {
    validatePhoneNumber(phoneNumber: string): boolean {
      const cleanPhone = phoneNumber.replace(/\s/g, '');
      const phoneRegex = /^(\+254|254|0)?(1[0-1]|7\d)(\d{7})$/;
      
      if (!phoneRegex.test(cleanPhone)) {
        return false;
      }
      
      const digitsOnly = cleanPhone.replace(/\D/g, '');
      let normalizedDigits = digitsOnly;
      
      if (digitsOnly.startsWith('0')) {
        normalizedDigits = '254' + digitsOnly.substring(1);
      } else if (digitsOnly.length === 9) {
        normalizedDigits = '254' + digitsOnly;
      }
      
      // Security: Check for suspicious patterns
      const sequentialRegex = /(0123|1234|2345|3456|4567|5678|6789|7890)/;
      if (sequentialRegex.test(normalizedDigits)) {
        return false;
      }
      
      const repeatedRegex = /(\d)\1{4,}/;
      if (repeatedRegex.test(normalizedDigits)) {
        return false;
      }
      
      return normalizedDigits.length === 12;
    },

    sanitizeInput(input: string, type: 'text' | 'phone' | 'otp' = 'text'): string {
      let sanitized = input.trim();
      
      switch (type) {
        case 'phone':
          sanitized = sanitized
            .replace(/[<>"'`;\\/&|$#{}[\]=]/g, '')
            .substring(0, SECURITY_CONFIG.MAX_PHONE_LENGTH);
          break;
        case 'otp':
          sanitized = sanitized.replace(/[^\d]/g, '').substring(0, SECURITY_CONFIG.OTP_LENGTH);
          break;
        default:
          sanitized = sanitized
            .replace(/[<>"'`;\\/&|$#{}[\]=]/g, '')
            .substring(0, SECURITY_CONFIG.MAX_NAME_LENGTH);
      }
      
      return sanitized;
    },

    normalizePhoneNumber(phoneNumber: string): string {
      const cleanPhone = phoneNumber.replace(/\s/g, '');
      const digitsOnly = cleanPhone.replace(/\D/g, '');
      
      let normalized = digitsOnly;
      if (digitsOnly.startsWith('0')) {
        normalized = '254' + digitsOnly.substring(1);
      } else if (digitsOnly.length === 9) {
        normalized = '254' + digitsOnly;
      }
      
      if (normalized.length !== 12) {
        throw new Error('Invalid phone number format after normalization');
      }
      
      return normalized;
    }
  };

  // Internal function to log security events (migrated from auth.ts)
  const logSecurityEvent = async (
    eventType: string, 
    severity: 'low' | 'medium' | 'high', 
    description: string, 
    userId?: string
  ) => {
    try {
      const securityEvent = {
        user_id: userId,
        event_type: eventType,
        severity: severity,
        description: description
      };

      await supabase
        .from('security_events')
        .insert(securityEvent);
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // SECURITY: Clear development rate limits on app start
        // This prevents persistent blocking during development
        await clearDevelopmentRateLimits();

        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
      } catch (error) {
        // Security: Generic error logging
        console.error('Auth initialization failed');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);

      if (event === 'SIGNED_OUT') {
        await SecureStore.deleteItemAsync('user_pin_set');
        await clearRateLimitData(); // Secure cleanup
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const normalizeAndValidatePhone = (phoneNumber: string): { success: boolean; normalized?: string; error?: string } => {
    // Remove all non-digit characters except +
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');
    
    // Strict Kenyan phone validation
    const phoneRegex = /^(?:\+254|0|254)?(7\d|1\d)\d{7}$/;
    
    if (!phoneRegex.test(cleaned)) {
      return { success: false, error: 'Invalid format' };
    }

    // Normalize to +254 format
    let normalized = cleaned;
    if (normalized.startsWith('0')) {
      normalized = '+254' + normalized.slice(1);
    } else if (normalized.startsWith('254') && !normalized.startsWith('+254')) {
      normalized = '+' + normalized;
    } else if (!normalized.startsWith('+254') && /^[17]/.test(normalized)) {
      normalized = '+254' + normalized;
    }

    if (normalized.length !== 13) {
      return { success: false, error: 'Invalid length' };
    }

    // Additional validation for Kenyan mobile prefixes
    const numberPart = normalized.slice(4);
    if (!/^(7[0-9]|1[0-7])\d{7}$/.test(numberPart)) {
      return { success: false, error: 'Invalid carrier' };
    }

    return { success: true, normalized };
  };

  const validateFullName = (name: string): { isValid: boolean; error?: string } => {
    const sanitized = name.trim();
    
    if (sanitized.length < 2 || sanitized.length > 100) {
      return { isValid: false, error: 'Invalid length' };
    }

    // Allow letters, spaces, hyphens, apostrophes, and periods
    const nameRegex = /^[a-zA-Z\s\-'.]+$/;
    if (!nameRegex.test(sanitized)) {
      return { isValid: false, error: 'Invalid characters' };
    }

    // Security: Prevent potential injection attacks
    const forbiddenPatterns = [
      /<script>/i,
      /javascript:/i,
      /on\w+=/i,
      /SELECT|INSERT|UPDATE|DELETE|DROP|UNION/i
    ];

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(sanitized)) {
        return { isValid: false, error: 'Invalid format' };
      }
    }

    return { isValid: true };
  };

  const validatePassword = (password: string): { isValid: boolean; error?: string } => {
    if (password.length < 8) {
      return { isValid: false, error: 'Too short' };
    }

    // Comprehensive password strength validation
    const requirements = [
      { regex: /[a-z]/, message: 'lowercase letter' },
      { regex: /[A-Z]/, message: 'uppercase letter' },
      { regex: /\d/, message: 'number' },
      { regex: /[@$!%*?&]/, message: 'special character' }
    ];

    for (const req of requirements) {
      if (!req.regex.test(password)) {
        return { isValid: false, error: `Missing ${req.message}` };
      }
    }

    // Check for common weak passwords
    const weakPasswords = [
      'password', '12345678', 'qwertyui', 'admin123', 'welcome',
      'password1', '123456789', 'abcd1234', 'pass1234', '00000000'
    ];
    
    if (weakPasswords.includes(password.toLowerCase())) {
      return { isValid: false, error: 'Too common' };
    }

    return { isValid: true };
  };

  // NEW: OTP authentication methods migrated from auth.ts
  const signInWithPhoneOTP = async (phoneNumber: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Input sanitization
      const cleanPhone = SecurityUtils.sanitizeInput(phoneNumber, 'phone');

      // Validation
      if (!cleanPhone) {
        return { success: false, error: 'Phone number is required' };
      }

      if (!SecurityUtils.validatePhoneNumber(cleanPhone)) {
        return { success: false, error: 'Please enter a valid Kenyan phone number' };
      }

      // Rate limiting for OTP requests
      const rateLimitCheck = await checkRateLimit(`otp_${cleanPhone}`);
      if (!rateLimitCheck.allowed) {
        const minutes = Math.ceil((rateLimitCheck.timeRemaining || SECURITY_CONFIG.RATE_LIMIT_DURATION) / (60 * 1000));
        await logSecurityEvent('otp_rate_limit_exceeded', 'medium', `OTP request rate limit exceeded for ${cleanPhone}`);
        return { 
          success: false, 
          error: `Too many OTP requests. Please try again in ${minutes} minute(s).`
        };
      }

      const normalizedPhone = SecurityUtils.normalizePhoneNumber(cleanPhone);

      const { error } = await supabase.auth.signInWithOtp({
        phone: normalizedPhone,
        options: {
          channel: 'sms'
        }
      });

      if (error) {
        console.error('Signin OTP request failed:', error.message);
        await logSecurityEvent('signin_otp_failed', 'medium', `Signin OTP request failed: ${error.message}`);
        
        if (error.message?.includes('rate limit') || error.code === 'rate_limit_exceeded') {
          return { success: false, error: 'Too many attempts. Please try again later.' };
        }
        
        return { success: false, error: 'Failed to send verification code. Please try again.' };
      }

      await logSecurityEvent('signin_otp_sent', 'low', `Signin OTP sent to ${normalizedPhone}`);

      return { success: true };
    } catch (error: any) {
      console.error('Signin OTP unexpected error:', error);
      await logSecurityEvent('signin_otp_unexpected_error', 'high', `Unexpected error during OTP signin: ${error.message}`);
      return { success: false, error: 'Login failed. Please try again.' };
    }
  };

  // NEW: OTP verification method migrated from auth.ts
  const verifyOTP = async (phoneNumber: string, token: string): Promise<{ success: boolean; error?: string; session?: Session }> => {
    try {
      // Input sanitization
      const cleanPhone = SecurityUtils.sanitizeInput(phoneNumber, 'phone');
      const cleanToken = SecurityUtils.sanitizeInput(token, 'otp');

      // Validation
      if (!cleanPhone || !cleanToken) {
        return { success: false, error: 'Phone number and OTP are required' };
      }

      if (!SecurityUtils.validatePhoneNumber(cleanPhone)) {
        return { success: false, error: 'Invalid phone number format' };
      }

      if (cleanToken.length !== SECURITY_CONFIG.OTP_LENGTH) {
        return { success: false, error: 'Invalid OTP format' };
      }

      // Rate limiting for OTP verification
      const rateLimitCheck = await checkRateLimit(`verify_${cleanPhone}`);
      if (!rateLimitCheck.allowed) {
        const minutes = Math.ceil((rateLimitCheck.timeRemaining || SECURITY_CONFIG.RATE_LIMIT_DURATION) / (60 * 1000));
        await logSecurityEvent('otp_verify_rate_limit_exceeded', 'medium', `OTP verification rate limit exceeded for ${cleanPhone}`);
        return { 
          success: false, 
          error: `Too many verification attempts. Please try again in ${minutes} minute(s).`
        };
      }

      const normalizedPhone = SecurityUtils.normalizePhoneNumber(cleanPhone);

      const { data, error } = await supabase.auth.verifyOtp({
        phone: normalizedPhone,
        token: cleanToken,
        type: 'sms',
      });

      if (error) {
        console.error('OTP verification failed:', error.message);
        await logSecurityEvent('otp_verification_failed', 'medium', `OTP verification failed: ${error.message}`);
        return { success: false, error: 'Invalid or expired OTP' };
      }

      // Reset rate limit on success
      await clearRateLimitData();
      await logSecurityEvent('otp_verified', 'low', `OTP verified successfully for ${normalizedPhone}`, data.session?.user?.id);

      return { success: true, session: data.session };
    } catch (error: any) {
      console.error('OTP verification unexpected error:', error);
      await logSecurityEvent('otp_verification_error', 'high', `Unexpected error during OTP verification: ${error.message}`);
      return { success: false, error: 'Verification failed. Please try again.' };
    }
  };

  const signup = async (
    phoneNumber: string, 
    password: string, 
    fullName: string
  ): Promise<{ success: boolean; error?: string }> => {
    // Input validation chain
    const nameValidation = validateFullName(fullName);
    if (!nameValidation.isValid) {
      return { success: false, error: 'Please enter a valid name' };
    }

    const phoneValidation = normalizeAndValidatePhone(phoneNumber);
    if (!phoneValidation.success) {
      return { success: false, error: 'Please enter a valid Kenyan phone number' };
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return { success: false, error: 'Password does not meet security requirements' };
    }

    // Rate limiting check
    const rateLimitCheck = await checkRateLimit(`signup_${phoneValidation.normalized}`);
    if (!rateLimitCheck.allowed) {
      const minutes = Math.ceil((rateLimitCheck.timeRemaining || SECURITY_CONFIG.RATE_LIMIT_DURATION) / (60 * 1000));
      return { 
        success: false, 
        error: `Too many attempts. Please try again in ${minutes} minute(s).`
      };
    }

    try {
      setIsLoading(true);

      const sanitizedFullName = fullName.trim();
      const normalizedPhone = phoneValidation.normalized!;

      // Create secure unique identifier
      const phoneHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        normalizedPhone + await getDeviceFingerprint() // Device-bound
      );
      const uniqueEmail = `${phoneHash}@wealthcircle.ke`;

      const { data, error } = await supabase.auth.signUp({
        email: uniqueEmail,
        password: password,
        options: {
          data: {
            full_name: sanitizedFullName,
            phone_number: normalizedPhone,
            phone_hash: phoneHash,
            signup_timestamp: new Date().toISOString(),
          },
        },
      });

      if (error) {
        // Security: Generic error messages
        if (error.message.includes('rate limit') || error.message.includes('too many requests')) {
          return { 
            success: false, 
            error: 'Too many attempts. Please try again later.' 
          };
        }
        
        if (error.message.includes('already registered') || error.message.includes('user_exists')) {
          return { 
            success: false, 
            error: 'An account with this phone number already exists.' 
          };
        }

        return { 
          success: false, 
          error: 'Registration failed. Please try again.' 
        };
      }

      if (data.user && data.user.identities && data.user.identities.length === 0) {
        return { 
          success: false, 
          error: 'An account with this phone number already exists.' 
        };
      }

      if (data.user) {
        // Clear rate limits on successful signup
        await clearRateLimitData();
        return { success: true };
      } else {
        return { success: false, error: 'Registration failed. Please try again.' };
      }
    } catch (error) {
      return { 
        success: false, 
        error: 'An unexpected error occurred.' 
      };
    } finally {
      setIsLoading(false);
    }
  };

  const signin = async (
    phoneNumber: string, 
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    const phoneValidation = normalizeAndValidatePhone(phoneNumber);
    if (!phoneValidation.success) {
      return { success: false, error: 'Invalid credentials' };
    }

    const rateLimitCheck = await checkRateLimit(`signin_${phoneValidation.normalized}`);
    if (!rateLimitCheck.allowed) {
      const minutes = Math.ceil((rateLimitCheck.timeRemaining || SECURITY_CONFIG.RATE_LIMIT_DURATION) / (60 * 1000));
      return { 
        success: false, 
        error: `Too many attempts. Please try again in ${minutes} minute(s).`
      };
    }

    try {
      setIsLoading(true);

      const normalizedPhone = phoneValidation.normalized!;
      const phoneHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        normalizedPhone + await getDeviceFingerprint()
      );
      const uniqueEmail = `${phoneHash}@wealthcircle.ke`;

      const { data, error } = await supabase.auth.signInWithPassword({
        email: uniqueEmail,
        password: password,
      });

      if (error) {
        return { 
          success: false, 
          error: 'Invalid phone number or password'
        };
      }

      if (data.user) {
        return { success: true };
      } else {
        return { success: false, error: 'Login failed' };
      }
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      await SecureStore.deleteItemAsync('user_pin_set');
      await clearRateLimitData();
    } catch (error) {
      throw new Error('Sign out failed');
    }
  };

  const value: AuthContextType = {
    user,
    session,
    isLoading,
    signOut,
    signup,
    signin,
    // NEW: OTP authentication methods
    signInWithPhoneOTP,
    verifyOTP,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};