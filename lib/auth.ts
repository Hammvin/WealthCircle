import { SecurityUtils } from '@/utils/security';
import { supabase } from '../utils/supabase';

export const AuthService = {
  async signUpWithPhone(phoneNumber: string, fullName: string) {
    try {
      // Input validation
      if (!fullName || fullName.length < 2) {
        return { success: false, error: 'Full name must be at least 2 characters' };
      }

      if (!await SecurityUtils.validatePhoneNumber(phoneNumber)) {
        return { success: false, error: 'Invalid phone number format' };
      }

      const cleanPhone = this.cleanPhoneNumber(phoneNumber);
      const sanitizedName = SecurityUtils.sanitizeInput(fullName);
      
      // Check if phone already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('phone_number', cleanPhone)
        .single();

      if (existingUser) {
        return { success: false, error: 'Phone number already registered' };
      }

      const temporaryPassword = await SecurityUtils.generateSecurePassword();

      const { data, error } = await supabase.auth.signUp({
        phone: cleanPhone,
        password: temporaryPassword,
      });

      if (error) {
        console.error('Auth signup error:', error.message);
        return { success: false, error: 'Registration failed. Please try again.' };
      }

      if (data.user) {
        const { error: profileError } = await supabase
          .from('users')
          .insert([
            {
              id: data.user.id,
              phone_number: cleanPhone,
              full_name: sanitizedName,
            },
          ]);

        if (profileError) {
          console.error('Profile creation error:', profileError);
          // Rollback auth user if profile creation fails
          await supabase.auth.admin.deleteUser(data.user.id);
          return { success: false, error: 'Profile setup failed' };
        }
      }

      return { success: true, user: data.user };
    } catch (error: any) {
      console.error('Signup unexpected error:', error);
      return { success: false, error: 'Registration failed. Please try again.' };
    }
  },

  async verifyOTP(phoneNumber: string, token: string) {
    try {
      if (!token || token.length !== 6) {
        return { success: false, error: 'Invalid OTP format' };
      }

      const cleanPhone = this.cleanPhoneNumber(phoneNumber);
      
      const { data, error } = await supabase.auth.verifyOtp({
        phone: cleanPhone,
        token: SecurityUtils.sanitizeInput(token),
        type: 'sms',
      });

      if (error) {
        console.error('OTP verification error:', error.message);
        return { success: false, error: 'Invalid or expired OTP' };
      }

      return { success: true, session: data.session };
    } catch (error: any) {
      console.error('OTP unexpected error:', error);
      return { success: false, error: 'Verification failed' };
    }
  },

  async setupPIN(pin: string) {
    try {
      if (!pin || pin.length !== 4 || !/^\d+$/.test(pin)) {
        return { success: false, error: 'PIN must be 4 digits' };
      }

      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        return { success: false, error: 'Authentication required' };
      }

      const pinHash = await SecurityUtils.hashPIN(pin);

      const { error } = await supabase
        .from('users')
        .update({ pin_hash: pinHash })
        .eq('id', user.data.user.id);

      if (error) {
        console.error('PIN setup error:', error);
        return { success: false, error: 'Failed to setup PIN' };
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('PIN setup unexpected error:', error);
      return { success: false, error: 'PIN setup failed' };
    }
  },

  async verifyPIN(pin: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!pin || pin.length !== 4 || !/^\d+$/.test(pin)) {
        return { success: false, error: 'Invalid PIN format' };
      }

      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        return { success: false, error: 'Authentication required' };
      }

      const { data } = await supabase
        .from('users')
        .select('pin_hash')
        .eq('id', user.data.user.id)
        .single();

      if (!data?.pin_hash) {
        return { success: false, error: 'PIN not set up' };
      }

      const isValid = await SecurityUtils.verifyPIN(pin, data.pin_hash);
      return { success: isValid, error: isValid ? undefined : 'Invalid PIN' };
    } catch (error) {
      console.error('PIN verification error:', error);
      return { success: false, error: 'PIN verification failed' };
    }
  },

  async checkRateLimit(identifier: string, action: string): Promise<boolean> {
    // Implement basic rate limiting
    const key = `rate_limit_${action}_${identifier}`;
    const now = Date.now();
    const lastAttempt = await SecureStore.getItemAsync(key);
    
    if (lastAttempt) {
      const timeDiff = now - parseInt(lastAttempt);
      if (timeDiff < 30000) { // 30 seconds between attempts
        return false;
      }
    }
    
    await SecureStore.setItemAsync(key, now.toString());
    return true;
  },

  private cleanPhoneNumber(phone: string): string {
    let clean = phone.replace(/\s+/g, '');
    if (clean.startsWith('0')) {
      clean = '+254' + clean.substring(1);
    } else if (!clean.startsWith('+')) {
      clean = '+254' + clean;
    }
    return clean;
  },
};