import { Database, supabase } from '@/lib/supabase';

// Security Configuration
const SECURITY_CONFIG = {
  MIN_PHONE_LENGTH: 10,
  MAX_PHONE_LENGTH: 15,
  MIN_NAME_LENGTH: 2,
  MAX_NAME_LENGTH: 100,
  OTP_LENGTH: 6,
  TEMP_PASSWORD_LENGTH: 12,
  RATE_LIMIT_WINDOW: 60000, // 1 minute
} as const;

// Type aliases for database tables
type User = Database['public']['Tables']['users']['Row'];
type SecurityEvent = Database['public']['Tables']['security_events']['Row'];
type UserInsert = Database['public']['Tables']['users']['Insert'];
type SecurityEventInsert = Database['public']['Tables']['security_events']['Insert'];

// Rate limiting storage
const authAttempts = new Map<string, { count: number; lastAttempt: number }>();

// Internal security utilities
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

  validateFullName(fullName: string): { valid: boolean; error?: string } {
    if (!fullName || fullName.trim().length < SECURITY_CONFIG.MIN_NAME_LENGTH) {
      return { valid: false, error: `Full name must be at least ${SECURITY_CONFIG.MIN_NAME_LENGTH} characters` };
    }

    if (fullName.length > SECURITY_CONFIG.MAX_NAME_LENGTH) {
      return { valid: false, error: `Full name too long (max ${SECURITY_CONFIG.MAX_NAME_LENGTH} characters)` };
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /<script/i, /javascript:/i, /onclick/i, /onload/i, /alert\(/i,
      /drop table/i, /select.*from/i, /insert into/i, /delete from/i
    ];
    
    if (suspiciousPatterns.some(pattern => pattern.test(fullName))) {
      return { valid: false, error: 'Invalid characters in name' };
    }

    return { valid: true };
  },

  generateSecureTemporaryPassword(): string {
    const chars = {
      lowercase: 'abcdefghijklmnopqrstuvwxyz',
      uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      numbers: '0123456789',
      symbols: '!@#$%^&*'
    };

    let password = '';
    
    // Ensure at least one of each type
    password += chars.lowercase[Math.floor(Math.random() * chars.lowercase.length)];
    password += chars.uppercase[Math.floor(Math.random() * chars.uppercase.length)];
    password += chars.numbers[Math.floor(Math.random() * chars.numbers.length)];
    password += chars.symbols[Math.floor(Math.random() * chars.symbols.length)];
    
    // Fill the rest randomly
    const allChars = chars.lowercase + chars.uppercase + chars.numbers + chars.symbols;
    for (let i = password.length; i < SECURITY_CONFIG.TEMP_PASSWORD_LENGTH; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
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

// Internal rate limiting function
const checkRateLimit = (identifier: string): { limited: boolean; message?: string } => {
  const now = Date.now();
  const attempt = authAttempts.get(identifier);
  
  if (!attempt) {
    authAttempts.set(identifier, { count: 1, lastAttempt: now });
    return { limited: false };
  }

  if (now - attempt.lastAttempt > SECURITY_CONFIG.RATE_LIMIT_WINDOW) {
    authAttempts.set(identifier, { count: 1, lastAttempt: now });
    return { limited: false };
  }

  if (attempt.count >= 5) {
    return { limited: true, message: 'Too many attempts. Please try again later.' };
  }

  authAttempts.set(identifier, { 
    count: attempt.count + 1, 
    lastAttempt: now 
  });
  
  return { limited: false };
};

// Internal function to check if phone number already exists
const checkPhoneNumberExists = async (phoneNumber: string): Promise<boolean> => {
  try {
    const normalizedPhone = SecurityUtils.normalizePhoneNumber(phoneNumber);
    
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

// Internal function to log security events
const logSecurityEvent = async (
  eventType: string, 
  severity: SecurityEvent['severity'], 
  description: string, 
  userId?: string
) => {
  try {
    const securityEvent: SecurityEventInsert = {
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

export const AuthService = {
  /**
   * Secure user registration with comprehensive validation
   */
  async signUpWithPhone(phoneNumber: string, fullName: string) {
    try {
      // Input sanitization
      const cleanPhone = SecurityUtils.sanitizeInput(phoneNumber, 'phone');
      const cleanFullName = SecurityUtils.sanitizeInput(fullName, 'text');

      // Validation
      if (!cleanPhone || !cleanFullName) {
        return { success: false, error: 'Phone number and full name are required' };
      }

      if (!SecurityUtils.validatePhoneNumber(cleanPhone)) {
        return { success: false, error: 'Please enter a valid Kenyan phone number' };
      }

      const nameValidation = SecurityUtils.validateFullName(cleanFullName);
      if (!nameValidation.valid) {
        return { success: false, error: nameValidation.error };
      }

      // Rate limiting
      const rateLimitCheck = checkRateLimit(`signup:${cleanPhone}`);
      if (rateLimitCheck.limited) {
        await logSecurityEvent('rate_limit_exceeded', 'medium', `Signup rate limit exceeded for ${cleanPhone}`);
        return { success: false, error: rateLimitCheck.message };
      }

      // Check if phone number already exists
      const normalizedPhone = SecurityUtils.normalizePhoneNumber(cleanPhone);
      const phoneExists = await checkPhoneNumberExists(normalizedPhone);
      if (phoneExists) {
        await logSecurityEvent('duplicate_registration_attempt', 'low', `Duplicate registration attempt for ${normalizedPhone}`);
        return { success: false, error: 'This phone number is already registered' };
      }

      // Generate secure temporary password
      const temporaryPassword = SecurityUtils.generateSecureTemporaryPassword();

      console.log('🔐 Starting secure registration process:', {
        normalizedPhone,
        nameLength: cleanFullName.length
      });

      // Step 1: Create auth user
      const { data, error } = await supabase.auth.signUp({
        phone: normalizedPhone,
        password: temporaryPassword,
        options: {
          data: {
            phone_number: normalizedPhone,
            full_name: cleanFullName,
          },
          channel: 'sms'
        },
      });

      if (error) {
        console.error('❌ Auth signup failed:', {
          code: error.code,
          message: error.message
        });
        
        await logSecurityEvent('auth_signup_failed', 'medium', `Auth signup failed: ${error.message}`, data?.user?.id);

        // Handle specific auth errors
        if (error.message?.includes('already registered') || error.code === 'user_already_exists') {
          return { success: false, error: 'This phone number is already registered' };
        }
        if (error.message?.includes('rate limit') || error.code === 'rate_limit_exceeded') {
          return { success: false, error: 'Too many attempts. Please try again later.' };
        }
        
        return { success: false, error: 'Registration failed. Please try again.' };
      }

      if (!data.user) {
        console.error('❌ No user returned from auth creation');
        return { success: false, error: 'Registration failed. Please try again.' };
      }

      console.log('✅ Auth user created, proceeding to profile creation:', {
        userId: data.user.id,
        normalizedPhone
      });

      // Step 2: Create user profile in database
      const profilePayload: UserInsert = {
        id: data.user.id,
        phone_number: normalizedPhone,
        full_name: cleanFullName,
        created_at: new Date().toISOString(),
      };

      const { error: profileError } = await supabase
        .from('users')
        .insert([profilePayload]);

      if (profileError) {
        console.error('❌ Profile creation failed:', {
          code: profileError.code,
          message: profileError.message
        });

        await logSecurityEvent('profile_creation_failed', 'high', `Profile creation failed: ${profileError.message}`, data.user.id);

        // Critical: Delete auth user if profile creation fails
        console.log('🔄 Cleaning up: Attempting to delete auth user due to profile creation failure');
        try {
          await supabase.auth.admin.deleteUser(data.user.id);
        } catch (deleteError) {
          console.error('⚠️ Failed to delete auth user after profile creation failure:', deleteError);
        }

        return { 
          success: false, 
          error: 'Registration failed. Please try again or contact support.' 
        };
      }

      console.log('✅ Profile created successfully for user:', data.user.id);

      // Security measures
      authAttempts.delete(`signup:${cleanPhone}`); // Reset rate limit
      await logSecurityEvent('user_registered', 'low', `User registered successfully: ${normalizedPhone}`, data.user.id);

      return { success: true, user: data.user };
    } catch (error: any) {
      console.error('💥 Signup unexpected error:', error);
      await logSecurityEvent('signup_unexpected_error', 'high', `Unexpected error during signup: ${error.message}`);
      return { success: false, error: 'An unexpected error occurred during registration. Please try again.' };
    }
  },

  /**
   * Secure OTP verification with validation
   */
  async verifyOTP(phoneNumber: string, token: string) {
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

      // Rate limiting
      const rateLimitCheck = checkRateLimit(`verify:${cleanPhone}`);
      if (rateLimitCheck.limited) {
        await logSecurityEvent('otp_rate_limit_exceeded', 'medium', `OTP verification rate limit exceeded for ${cleanPhone}`);
        return { success: false, error: rateLimitCheck.message };
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
      authAttempts.delete(`verify:${cleanPhone}`);
      await logSecurityEvent('otp_verified', 'low', `OTP verified successfully for ${normalizedPhone}`, data.session?.user?.id);

      return { success: true, session: data.session };
    } catch (error: any) {
      console.error('OTP verification unexpected error:', error);
      await logSecurityEvent('otp_verification_error', 'high', `Unexpected error during OTP verification: ${error.message}`);
      return { success: false, error: 'Verification failed. Please try again.' };
    }
  },

  /**
   * Secure phone sign-in with OTP
   */
  async signInWithPhone(phoneNumber: string) {
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

      // Rate limiting
      const rateLimitCheck = checkRateLimit(`signin:${cleanPhone}`);
      if (rateLimitCheck.limited) {
        await logSecurityEvent('signin_rate_limit_exceeded', 'medium', `Signin rate limit exceeded for ${cleanPhone}`);
        return { success: false, error: rateLimitCheck.message };
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

      // Reset rate limit on success
      authAttempts.delete(`signin:${cleanPhone}`);
      await logSecurityEvent('signin_otp_sent', 'low', `Signin OTP sent to ${normalizedPhone}`);

      return { success: true };
    } catch (error: any) {
      console.error('Signin unexpected error:', error);
      await logSecurityEvent('signin_unexpected_error', 'high', `Unexpected error during signin: ${error.message}`);
      return { success: false, error: 'Login failed. Please try again.' };
    }
  },

  /**
   * Secure sign-out with session cleanup
   */
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Signout error:', error.message);
        await logSecurityEvent('signout_failed', 'medium', `Signout failed: ${error.message}`);
        throw error;
      }

      await logSecurityEvent('user_signed_out', 'low', 'User signed out successfully');
      return { success: true };
    } catch (error: any) {
      console.error('Signout unexpected error:', error);
      await logSecurityEvent('signout_error', 'high', `Unexpected error during signout: ${error.message}`);
      return { success: false, error: 'Failed to sign out. Please try again.' };
    }
  },

  /**
   * Check current session status
   */
  async getCurrentSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Session check error:', error.message);
        return { success: false, error: 'Session check failed' };
      }

      return { success: true, session };
    } catch (error: any) {
      console.error('Session check unexpected error:', error);
      return { success: false, error: 'Session check failed' };
    }
  },

  /**
   * Get current user profile
   */
  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        return { success: false, error: 'User not authenticated' };
      }

      // Fetch user profile from database
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        return { success: false, error: 'Failed to load user profile' };
      }

      return { success: true, user: { ...user, ...profile } };
    } catch (error: any) {
      console.error('Get user unexpected error:', error);
      return { success: false, error: 'Failed to get user information' };
    }
  }
};