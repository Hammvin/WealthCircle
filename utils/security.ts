import * as Crypto from 'expo-crypto';

export const SecurityUtils = {
  async hashPIN(pin: string): Promise<string> {
    try {
      const salt = await Crypto.getRandomBytesAsync(16);
      const saltHex = Array.from(new Uint8Array(salt))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        pin + saltHex
      );
      
      return `${saltHex}:${hash}`;
    } catch (error) {
      throw new Error('PIN hashing failed');
    }
  },

  async verifyPIN(pin: string, storedHash: string): Promise<boolean> {
    try {
      const [saltHex, originalHash] = storedHash.split(':');
      const testHash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        pin + saltHex
      );
      
      return testHash === originalHash;
    } catch (error) {
      return false;
    }
  },

  async generateSecurePassword(): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const randomValues = await Crypto.getRandomBytesAsync(16);
    let password = '';
    
    for (let i = 0; i < 16; i++) {
      password += chars[randomValues[i] % chars.length];
    }
    
    return password;
  },

  async validatePhoneNumber(phone: string): Promise<boolean> {
    const cleanPhone = phone.replace(/\s+/g, '');
    const kenyanPhoneRegex = /^(\+254|0)?[17][0-9]{8}$/;
    return kenyanPhoneRegex.test(cleanPhone);
  },

  sanitizeInput(input: string): string {
    return input
      .trim()
      .replace(/[<>]/g, '')
      .substring(0, 255); // Limit length
  },
};