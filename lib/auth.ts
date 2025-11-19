import { supabase } from '@/utils/supabase';

export const AuthService = {
  async signUpWithPhone(phoneNumber: string, fullName: string) {
    try {
      if (!fullName || fullName.length < 2) {
        return { success: false, error: 'Full name must be at least 2 characters' };
      }

      const { data, error } = await supabase.auth.signUp({
        phone: phoneNumber,
        password: this.generateTemporaryPassword(),
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
              phone_number: phoneNumber,
              full_name: fullName,
            },
          ]);

        if (profileError) {
          console.error('Profile creation error:', profileError);
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

      const { data, error } = await supabase.auth.verifyOtp({
        phone: phoneNumber,
        token,
        type: 'sms',
      });

      if (error) {
        return { success: false, error: 'Invalid or expired OTP' };
      }

      return { success: true, session: data.session };
    } catch (error: any) {
      return { success: false, error: 'Verification failed' };
    }
  },

  async signInWithPhone(phoneNumber: string) {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: phoneNumber,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: 'Login failed' };
    }
  },

  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  private generateTemporaryPassword(): string {
    return Math.random().toString(36).slice(-10) + 'A1!';
  }
};