import { supabase } from '@/lib/supabase';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Database } from '../database.types';

// Types for TypeScript
interface User {
  id: string;
  phone_number: string;
  full_name: string;
  email: string;
  risk_score: number;
  profile_data: any;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (phoneNumber: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (phoneNumber: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (updates: Partial<Database['public']['Tables']['users']['Update']>) => Promise<{ success: boolean; error?: string }>;
  getChamaStats: (chamaId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Security Constants
const SECURITY_CONFIG = {
  RATE_LIMIT_ATTEMPTS: 5,
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  MAX_PASSWORD_AGE: 90 * 24 * 60 * 60 * 1000, // 90 days
  TOKEN_REFRESH_BUFFER: 5 * 60 * 1000, // 5 minutes
} as const;

// Secure Storage Keys
const STORAGE_KEYS = {
  LAST_PASSWORD_CHANGE: 'wealthcircle_last_password_change',
  SESSION_START: 'wealthcircle_session_start',
} as const;

// Rate limiting storage with automatic cleanup
const authAttempts = new Map<string, { count: number; lastAttempt: number; permanentBlock?: boolean }>();

// Clean up old rate limit entries every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, attempt] of authAttempts.entries()) {
    if (now - attempt.lastAttempt > SECURITY_CONFIG.RATE_LIMIT_WINDOW * 2) {
      authAttempts.delete(key);
    }
  }
}, 60 * 60 * 1000);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionStart, setSessionStart] = useState<number | null>(null);

  /**
   * Check if phone number already exists in database
   */
  const checkPhoneNumberExists = async (phoneNumber: string): Promise<boolean> => {
    try {
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      
      const { data, error } = await supabase
        .from('users')
        .select('phone_number')
        .eq('phone_number', normalizedPhone)
        .maybeSingle();

      if (error) {
        console.error('Error checking phone number:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Error in checkPhoneNumberExists:', error);
      return false;
    }
  };

  /**
   * Enhanced password strength validation
   */
  const validatePasswordStrength = (password: string): { valid: boolean; error?: string } => {
    if (password.length < 8) {
      return { valid: false, error: 'Password must be at least 8 characters' };
    }

    if (!/(?=.*[a-z])/.test(password)) {
      return { valid: false, error: 'Password must include at least one lowercase letter' };
    }

    if (!/(?=.*[A-Z])/.test(password)) {
      return { valid: false, error: 'Password must include at least one uppercase letter' };
    }

    if (!/(?=.*\d)/.test(password)) {
      return { valid: false, error: 'Password must include at least one number' };
    }

    if (!/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(password)) {
      return { valid: false, error: 'Password must include at least one special character' };
    }

    // Check for common weak patterns
    const weakPatterns = [
      'password', '123456', 'qwerty', 'admin', 'welcome',
      'password123', 'admin123', 'qwerty123'
    ];
    
    const lowerPassword = password.toLowerCase();
    if (weakPatterns.some(pattern => lowerPassword.includes(pattern))) {
      return { valid: false, error: 'Password is too common or predictable' };
    }

    // Check for sequential characters
    const sequentialRegex = /(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i;
    if (sequentialRegex.test(password)) {
      return { valid: false, error: 'Password contains sequential characters' };
    }

    return { valid: true };
  };

  /**
   * Check if request is rate limited with enhanced security
   */
  const checkRateLimit = (identifier: string): { limited: boolean; message?: string } => {
    const now = Date.now();
    const attempt = authAttempts.get(identifier);
    
    if (attempt?.permanentBlock) {
      return { limited: true, message: 'Account temporarily locked. Please contact support.' };
    }

    if (!attempt) {
      authAttempts.set(identifier, { count: 1, lastAttempt: now });
      return { limited: false };
    }

    // Reset counter if more than time window has passed
    if (now - attempt.lastAttempt > SECURITY_CONFIG.RATE_LIMIT_WINDOW) {
      authAttempts.set(identifier, { count: 1, lastAttempt: now });
      return { limited: false };
    }

    // Check attempts
    if (attempt.count >= SECURITY_CONFIG.RATE_LIMIT_ATTEMPTS) {
      // Permanent block for 1 hour after too many attempts
      authAttempts.set(identifier, { 
        ...attempt, 
        permanentBlock: true,
        lastAttempt: now 
      });
      
      // Auto-unblock after 1 hour
      setTimeout(() => {
        const currentAttempt = authAttempts.get(identifier);
        if (currentAttempt) {
          authAttempts.set(identifier, { count: 0, lastAttempt: Date.now() });
        }
      }, 60 * 60 * 1000);
      
      return { limited: true, message: 'Too many attempts. Account temporarily locked.' };
    }

    authAttempts.set(identifier, { 
      count: attempt.count + 1, 
      lastAttempt: now 
    });
    
    return { limited: false };
  };

  /**
   * Check session timeout
   */
  const checkSessionTimeout = async (): Promise<boolean> => {
    if (!sessionStart) return true;
    
    const sessionAge = Date.now() - sessionStart;
    if (sessionAge > SECURITY_CONFIG.SESSION_TIMEOUT) {
      await logout();
      return false;
    }
    
    return true;
  };

  /**
   * Enhanced Kenyan phone number validation with comprehensive format support
   */
  const validatePhoneNumber = (phoneNumber: string): boolean => {
    // Remove only spaces for validation, keep + and digits
    const cleanPhone = phoneNumber.replace(/\s/g, '');
    
    // Enhanced Kenyan phone number regex - handles all valid formats with +254
    const phoneRegex = /^(\+254|254|0)?(1[0-1]|7\d)(\d{7})$/;
    
    if (!phoneRegex.test(cleanPhone)) {
      console.log('Phone validation failed for:', cleanPhone);
      return false;
    }
    
    // Extract digits for pattern checking (remove + but keep digits)
    const digitsOnly = cleanPhone.replace(/\D/g, '');
    
    // Convert to 12-digit format for pattern checks
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
    
    // Validate final length - should be exactly 12 digits for Kenyan numbers
    const isValid = normalizedDigits.length === 12;
    if (!isValid) {
      console.log('Invalid phone length:', normalizedDigits.length, 'for:', normalizedDigits);
    }
    return isValid;
  };

  /**
   * Normalize phone number to consistent format for storage
   */
  const normalizePhoneNumber = (phoneNumber: string): string => {
    // Remove only spaces, keep + and digits for processing
    const cleanPhone = phoneNumber.replace(/\s/g, '');
    const digitsOnly = cleanPhone.replace(/\D/g, '');
    
    // Convert to 12-digit format without + prefix for consistent storage
    let normalized = digitsOnly;
    if (digitsOnly.startsWith('0')) {
      normalized = '254' + digitsOnly.substring(1);
    } else if (digitsOnly.length === 9) {
      normalized = '254' + digitsOnly;
    }
    
    // Ensure it's exactly 12 digits
    if (normalized.length !== 12) {
      console.error('Invalid normalized phone length:', normalized.length, 'for:', phoneNumber);
      throw new Error('Invalid phone number format after normalization');
    }
    
    return normalized;
  };

  /**
   * Generate secure random string for email suffix
   */
  const generateSecureRandomString = (length: number = 8): string => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  /**
   * Enhanced input sanitization for different input types
   */
  const sanitizeInput = (input: string, type: 'text' | 'phone' | 'email' | 'password' = 'text'): string => {
    let sanitized = input.trim();
    
    switch (type) {
      case 'phone':
        // For phone numbers, only remove dangerous characters but keep + and digits
        sanitized = sanitized
          .replace(/[<>"'`;\\/&|$#{}[\]=]/g, '') // Remove dangerous chars
          .substring(0, 16); // Reasonable length for phone numbers
        break;
        
      case 'email':
        // For emails, be more permissive but still remove dangerous chars
        sanitized = sanitized
          .replace(/[<>"'`;\\/&|$#{}[\]=]/g, '')
          .substring(0, 254);
        break;
        
      case 'password':
        // For passwords, allow most characters but remove extreme ones
        sanitized = sanitized
          .replace(/[<>"'`;\\/&|$#{}[\]=]/g, '')
          .substring(0, 100);
        break;
        
      default: // text
        // For general text, use strict sanitization
        sanitized = sanitized
          .replace(/[<>"'`;\\/&|$#{}[\]=]/g, '')
          .normalize('NFKC') // Normalize unicode
          .substring(0, 100);
    }
    
    return sanitized;
  };

  /**
   * Generate secure email from phone number - FIXED RATE LIMIT ISSUE
   */
  const generateSecureEmail = (phoneNumber: string): string => {
    try {
      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      
      // FIX: Use consistent domain and format to avoid rate limits
      // Same phone number = same email every time
      const email = `user.${normalizedPhone}@wealthcircle.ke`;
      
      console.log('Generated email for signup:', email);
      return email;
    } catch (error) {
      console.error('Email generation error:', error);
      throw new Error('Invalid phone number format for email generation');
    }
  };

  /**
   * Validate email format
   */
  const validateEmailFormat = (email: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
    return emailRegex.test(email) && email.length <= 254 && email.length > 3;
  };

  /**
   * Fetch user profile from database with enhanced security
   */
  const fetchUserProfile = async (userId: string): Promise<User | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, phone_number, full_name, email, risk_score, created_at')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      return data as User;
    } catch (error) {
      console.error('Error in fetchUserProfile');
      return null;
    }
  };

  /**
 * Enhanced secure user registration with comprehensive error handling
 */
const signup = async (phoneNumber: string, password: string, fullName: string) => {
  try {
    // Sanitize inputs with appropriate types
    const cleanPhone = sanitizeInput(phoneNumber, 'phone');
    const cleanPassword = sanitizeInput(password, 'password');
    const cleanFullName = sanitizeInput(fullName, 'text');

    // Validation
    if (!cleanPhone || !cleanPassword || !cleanFullName) {
      return { success: false, error: 'All fields are required' };
    }

    if (!validatePhoneNumber(cleanPhone)) {
      return { success: false, error: 'Please enter a valid Kenyan phone number' };
    }

    const passwordStrength = validatePasswordStrength(cleanPassword);
    if (!passwordStrength.valid) {
      return { success: false, error: passwordStrength.error };
    }

    if (cleanFullName.length < 2) {
      return { success: false, error: 'Full name must be at least 2 characters' };
    }

    // Rate limiting check
    const rateLimitCheck = checkRateLimit(`signup:${cleanPhone}`);
    if (rateLimitCheck.limited) {
      return { success: false, error: rateLimitCheck.message };
    }

    // Check if phone number already exists BEFORE creating account
    const normalizedPhone = normalizePhoneNumber(cleanPhone);
    const phoneExists = await checkPhoneNumberExists(normalizedPhone);
    if (phoneExists) {
      return { success: false, error: 'This phone number is already registered' };
    }

    setIsLoading(true);

    // Generate secure email format using normalized phone number
    const email = generateSecureEmail(normalizedPhone);

    console.log('🔐 Starting secure signup process:', {
      normalizedPhone,
      email: email.substring(0, 20) + '...', // Log partial email for security
      fullNameLength: cleanFullName.length
    });

    // Step 1: Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: cleanPassword,
      options: {
        data: {
          phone_number: normalizedPhone,
          full_name: cleanFullName,
        },
        emailRedirectTo: 'wealthcircle://auth-callback',
      },
    });

    if (authError) {
      console.error('❌ Auth creation failed:', {
        code: authError.code,
        message: authError.message
      });
      
      // Handle specific Supabase auth errors
      if (authError.message?.includes('already registered') || authError.code === 'user_already_exists') {
        return { success: false, error: 'This phone number is already registered' };
      }
      if (authError.message?.includes('password') || authError.code === 'weak_password') {
        return { success: false, error: 'Password does not meet security requirements' };
      }
      if (authError.message?.includes('email') || authError.code === 'invalid_email') {
        return { success: false, error: 'Invalid phone number format' };
      }
      if (authError.message?.includes('rate limit') || authError.code === 'rate_limit_exceeded') {
        return { success: false, error: 'Too many attempts. Please try again later.' };
      }
      
      return { success: false, error: 'Registration failed. Please try again.' };
    }

    if (!authData.user) {
      console.error('❌ No user returned from auth creation');
      return { success: false, error: 'Registration failed. Please try again.' };
    }

    console.log('✅ Auth user created, proceeding to profile creation:', {
      userId: authData.user.id,
      normalizedPhone
    });

    // Step 2: Create user profile in database
    const profilePayload = {
      id: authData.user.id,
      phone_number: normalizedPhone,
      full_name: cleanFullName,
      email: email,
      created_at: new Date().toISOString(),
    };

    console.log('📝 Profile payload to be inserted:', profilePayload);

    const { data: profileData, error: profileError } = await supabase
      .from('users')
      .insert([profilePayload])
      .select('id, phone_number, full_name, email, created_at');

    if (profileError) {
      console.error('❌ Profile creation failed with detailed error:', {
        code: profileError.code,
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint
      });

      // Critical: Delete auth user if profile creation fails to prevent orphaned accounts
      console.log('🔄 Cleaning up: Deleting auth user due to profile creation failure');
      try {
        await supabase.auth.admin.deleteUser(authData.user.id);
      } catch (deleteError) {
        console.error('⚠️ Failed to delete auth user after profile creation failure:', deleteError);
      }

      // Handle specific profile creation errors
      if (profileError.code === '23505') { // Unique violation
        return { success: false, error: 'This phone number is already registered' };
      }
      if (profileError.code === '23502') { // Not null violation
        return { success: false, error: 'Registration failed: Required information missing' };
      }
      if (profileError.code === '42501') { // Insufficient privileges
        return { success: false, error: 'Registration temporarily unavailable' };
      }
      
      return { 
        success: false, 
        error: 'Registration failed. Please try again or contact support.' 
      };
    }

    // Verify profile was created successfully
    if (!profileData || profileData.length === 0) {
      console.error('❌ Profile creation returned no data');
      
      // Clean up auth user
      try {
        await supabase.auth.admin.deleteUser(authData.user.id);
      } catch (deleteError) {
        console.error('⚠️ Failed to delete auth user after empty profile response:', deleteError);
      }
      
      return { success: false, error: 'Registration failed. Please try again.' };
    }

    console.log('✅ Profile created successfully:', {
      profileId: profileData[0].id,
      savedPhone: profileData[0].phone_number,
      savedName: profileData[0].full_name
    });

    // Step 3: Final verification - fetch complete user profile
    const userProfile = await fetchUserProfile(authData.user.id);
    if (!userProfile) {
      console.error('❌ Failed to fetch user profile after creation');
      // Don't delete here as profile was created successfully
      return { 
        success: false, 
        error: 'Registration completed but failed to load profile. Please try logging in.' 
      };
    }

    console.log('✅ User profile verified:', {
      userId: userProfile.id,
      phone: userProfile.phone_number,
      name: userProfile.full_name
    });

    // Security measures
    authAttempts.delete(`signup:${cleanPhone}`); // Reset rate limit
    await SecureStore.setItemAsync(STORAGE_KEYS.LAST_PASSWORD_CHANGE, Date.now().toString());
    
    setUser(userProfile);
    
    console.log('🎉 Signup process completed successfully');
    return { success: true };

  } catch (error) {
    console.error('💥 Signup unexpected error:', error);
    return { 
      success: false, 
      error: 'An unexpected error occurred during registration. Please try again.' 
    };
  } finally {
    setIsLoading(false);
  }
};
  // ... rest of the functions (login, changePassword, resetPassword, updateProfile, getChamaStats, logout) remain the same

  /**
   * Enhanced secure login with all security measures
   */
  const login = async (phoneNumber: string, password: string) => {
    try {
      // Input validation and sanitization with appropriate types
      const cleanPhone = sanitizeInput(phoneNumber, 'phone');
      const cleanPassword = sanitizeInput(password, 'password');

      if (!cleanPhone || !cleanPassword) {
        return { success: false, error: 'Phone number and password are required' };
      }

      if (!validatePhoneNumber(cleanPhone)) {
        return { success: false, error: 'Please enter a valid Kenyan phone number' };
      }

      // Rate limiting check
      const rateLimitCheck = checkRateLimit(`login:${cleanPhone}`);
      if (rateLimitCheck.limited) {
        return { success: false, error: rateLimitCheck.message };
      }

      setIsLoading(true);

      try {
        // Generate secure email format using normalized phone number
        const normalizedPhone = normalizePhoneNumber(cleanPhone);
        const email = generateSecureEmail(normalizedPhone);
        
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: cleanPassword,
        });

        if (error) {
          console.error('Login auth error:', error.message);
          
          // Handle specific auth errors
          if (error.message?.includes('Invalid login credentials')) {
            return { success: false, error: 'Invalid phone number or password' };
          }
          if (error.message?.includes('Email not confirmed')) {
            return { success: false, error: 'Please verify your account before logging in' };
          }
          
          return { success: false, error: 'Login failed. Please try again.' };
        }

        if (data.user) {
          // Reset rate limit on successful login
          authAttempts.delete(`login:${cleanPhone}`);
          
          // Set session start time
          const sessionStartTime = Date.now();
          setSessionStart(sessionStartTime);
          await SecureStore.setItemAsync(STORAGE_KEYS.SESSION_START, sessionStartTime.toString());
          
          const userProfile = await fetchUserProfile(data.user.id);
          if (userProfile) {
            setUser(userProfile);
            return { success: true };
          }
        }

        return { success: false, error: 'Failed to load user profile' };
      } catch (emailError) {
        console.error('Email generation error during login:', emailError);
        return { success: false, error: 'Invalid phone number format' };
      }
    } catch (error) {
      console.error('Login unexpected error');
      return { success: false, error: 'Login failed. Please try again.' };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Enhanced password change with security validation
   */
  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      // Validation
      if (!currentPassword.trim() || !newPassword.trim()) {
        return { success: false, error: 'Both current and new password are required' };
      }

      const passwordStrength = validatePasswordStrength(newPassword);
      if (!passwordStrength.valid) {
        return { success: false, error: passwordStrength.error };
      }

      if (currentPassword === newPassword) {
        return { success: false, error: 'New password must be different from current password' };
      } 

      // Session timeout check
      const sessionValid = await checkSessionTimeout();
      if (!sessionValid) {
        return { success: false, error: 'Session expired' };
      }

      // Rate limiting
      const rateLimitCheck = checkRateLimit(`changePassword:${user?.id}`);
      if (rateLimitCheck.limited) {
        return { success: false, error: rateLimitCheck.message };
      }

      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        return { success: false, error: 'User not authenticated' };
      }

      // Update password through Supabase
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        console.error('Password change error:', error.message);
        return { success: false, error: 'Failed to change password' };
      }

      // Store password change timestamp
      await SecureStore.setItemAsync(STORAGE_KEYS.LAST_PASSWORD_CHANGE, Date.now().toString());

      return { success: true };
    } catch (error) {
      console.error('Password change unexpected error');
      return { success: false, error: 'Failed to change password' };
    }
  };

  /**
   * Send password reset email with enhanced security
   */
  const resetPassword = async (email: string) => {
    try {
      const cleanEmail = sanitizeInput(email, 'email');
      
      if (!cleanEmail.trim()) {
        return { success: false, error: 'Email is required' };
      }

      // Rate limiting check
      const rateLimitCheck = checkRateLimit(`reset:${cleanEmail}`);
      if (rateLimitCheck.limited) {
        return { success: false, error: rateLimitCheck.message };
      }

      // Enhanced email validation
      if (!validateEmailFormat(cleanEmail)) {
        return { success: false, error: 'Please enter a valid email address' };
      }

      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: 'wealthcircle://reset-password',
      });

      if (error) {
        console.error('Password reset error:', error.message);
        return { success: false, error: 'Failed to send reset email' };
      }

      return { success: true };
    } catch (error) {
      console.error('Password reset unexpected error');
      return { success: false, error: 'Failed to send reset email' };
    }
  };

  /**
   * Update user profile information with enhanced security
   */
  const updateProfile = async (updates: Partial<Database['public']['Tables']['users']['Update']>) => {
    try {
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      // Session timeout check
      const sessionValid = await checkSessionTimeout();
      if (!sessionValid) {
        return { success: false, error: 'Session expired' };
      }

      // Sanitize string inputs
      const sanitizedUpdates: Partial<Database['public']['Tables']['users']['Update']> = { ...updates };
      
      if (updates.full_name && typeof updates.full_name === 'string') {
        const sanitizedName = sanitizeInput(updates.full_name, 'text');
        if (!sanitizedName || sanitizedName.length < 2) {
          return { success: false, error: 'Full name must be at least 2 characters' };
        }
        sanitizedUpdates.full_name = sanitizedName;
      }

      if (updates.phone_number && typeof updates.phone_number === 'string') {
        const sanitizedPhone = sanitizeInput(updates.phone_number, 'phone');
        if (!validatePhoneNumber(sanitizedPhone)) {
          return { success: false, error: 'Please enter a valid Kenyan phone number' };
        }
        sanitizedUpdates.phone_number = normalizePhoneNumber(sanitizedPhone);
      }

      // Prevent updating sensitive fields
      delete (sanitizedUpdates as any).id;
      delete (sanitizedUpdates as any).created_at;
      delete (sanitizedUpdates as any).email;
      delete (sanitizedUpdates as any).risk_score;

      const { data, error } = await supabase
        .from('users')
        .update(sanitizedUpdates)
        .eq('id', user.id)
        .select('id, phone_number, full_name, email, risk_score, created_at')
        .single();

      if (error) {
        console.error('Profile update error');
        return { success: false, error: 'Failed to update profile' };
      }

      // Refresh user data
      const updatedProfile = await fetchUserProfile(user.id);
      if (updatedProfile) {
        setUser(updatedProfile);
      }

      return { success: true };
    } catch (error) {
      console.error('Update profile error');
      return { success: false, error: 'Failed to update profile' };
    }
  };

  /**
   * Get chama statistics securely with input validation
   */
  const getChamaStats = async (chamaId: string) => {
    try {
      if (!chamaId) {
        return { success: false, error: 'Invalid chama ID' };
      }

      // Session timeout check
      const sessionValid = await checkSessionTimeout();
      if (!sessionValid) {
        return { success: false, error: 'Session expired' };
      }

      const { data, error } = await supabase
        .rpc('get_chama_stats', { chama_id: chamaId })
        .single();

      if (error) {
        console.error('Chama stats error');
        return { success: false, error: 'Failed to fetch chama statistics' };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Chama stats error');
      return { success: false, error: 'Failed to fetch chama statistics' };
    }
  };

  /**
   * Enhanced secure logout
   */
  const logout = async () => {
    try {      
      // Clear secure storage
      await SecureStore.deleteItemAsync(STORAGE_KEYS.SESSION_START);
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error.message);
      }
      setUser(null);
      setSessionStart(null);
    } catch (error) {
      console.error('Logout unexpected error');
    }
  };

  // Enhanced auth status check with session management
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Check session timeout
          const storedSessionStart = await SecureStore.getItemAsync(STORAGE_KEYS.SESSION_START);
          const sessionStartTime = storedSessionStart ? parseInt(storedSessionStart) : Date.now();
          
          if (Date.now() - sessionStartTime > SECURITY_CONFIG.SESSION_TIMEOUT) {
            await logout();
            return;
          }
          
          setSessionStart(sessionStartTime);
          const userProfile = await fetchUserProfile(session.user.id);
          setUser(userProfile);
        }
      } catch (error) {
        console.error('Auth check error');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    // Enhanced auth state change listener with session management
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
          const sessionStartTime = Date.now();
          setSessionStart(sessionStartTime);
          await SecureStore.setItemAsync(STORAGE_KEYS.SESSION_START, sessionStartTime.toString());
          
          const userProfile = await fetchUserProfile(session.user.id);
          setUser(userProfile);
        } else if (event === 'SIGNED_OUT') {
          await logout();
        } else if (event === 'TOKEN_REFRESHED') {
          // Update session timestamp on token refresh
          setSessionStart(Date.now());
        }
      }
    );

    // Auto-logout on session timeout
    const sessionCheckInterval = setInterval(async () => {
      if (sessionStart && Date.now() - sessionStart > SECURITY_CONFIG.SESSION_TIMEOUT) {
        await logout();
      }
    }, 60000); // Check every minute

    return () => {
      subscription.unsubscribe();
      clearInterval(sessionCheckInterval);
    };
  }, [sessionStart]);

  const value = {
    user,
    isLoading,
    login,
    signup,
    logout,
    changePassword, 
    resetPassword, 
    updateProfile,
    getChamaStats,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};