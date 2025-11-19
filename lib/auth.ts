import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

export const AuthService = {
  async signUpWithPhone(phoneNumber: string, fullName: string) {
    try {
      const cleanPhone = this.cleanPhoneNumber(phoneNumber);
      
      const { data, error } = await supabase.auth.signUp({
        phone: cleanPhone,
        password: this.generateTemporaryPassword(),
      });

      if (error) throw error;

      if (data.user) {
        const { error: profileError } = await supabase
          .from('users')
          .insert([
            {
              id: data.user.id,
              phone_number: cleanPhone,
              full_name: fullName,
            },
          ]);

        if (profileError) throw profileError;
      }

      return { success: true, user: data.user };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  async verifyOTP(phoneNumber: string, token: string) {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: this.cleanPhoneNumber(phoneNumber),
        token,
        type: 'sms',
      });

      if (error) throw error;
      return { success: true, session: data.session };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  async setupPIN(pin: string) {
    try {
      const pinHash = await this.hashPIN(pin);
      const user = await supabase.auth.getUser();
      
      if (!user.data.user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('users')
        .update({ pin_hash: pinHash })
        .eq('id', user.data.user.id);

      if (error) throw error;
      
      await SecureStore.setItemAsync('user_pin_set', 'true');
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  async verifyPIN(pin: string): Promise<boolean> {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return false;

      const { data } = await supabase
        .from('users')
        .select('pin_hash')
        .eq('id', user.data.user.id)
        .single();

      if (!data?.pin_hash) return false;

      const hashedInput = await this.hashPIN(pin);
      return data.pin_hash === hashedInput;
    } catch {
      return false;
    }
  },

  private cleanPhoneNumber(phone: string): string {
    return phone.replace(/\s+/g, '').replace(/^0/, '+254');
  },

  private generateTemporaryPassword(): string {
    return Math.random().toString(36).slice(-10) + 'A1!';
  },

  private async hashPIN(pin: string): Promise<string> {
    // In production, use proper hashing like bcrypt
    return btoa(pin);
  },
};