import { SecurityUtils } from '@/utils/security';

export const MpesaService = {
  async initiateSTKPush(phoneNumber: string, amount: number, chamaId: string) {
    try {
      // Validate inputs
      if (!await SecurityUtils.validatePhoneNumber(phoneNumber)) {
        throw new Error('Invalid phone number format');
      }

      if (amount <= 0 || amount > 150000) { // M-Pesa limit
        throw new Error('Invalid amount');
      }

      if (!chamaId) {
        throw new Error('Chama ID required');
      }

      const cleanPhone = this.cleanPhoneNumber(phoneNumber);

      // TODO: Integrate with Africa's Talking or Daraja API
      // For now, simulate API call with proper error handling
      console.log('Initiating STK Push:', { 
        phoneNumber: cleanPhone, 
        amount, 
        chamaId 
      });
      
      // Simulate API call with timeout
      return await new Promise((resolve, reject) => {
        setTimeout(() => {
          // Simulate random failures for testing
          if (Math.random() < 0.1) { // 10% failure rate for testing
            reject(new Error('Network error occurred'));
          } else {
            resolve({ 
              success: true, 
              message: 'Payment request sent successfully',
              requestId: this.generateRequestId()
            });
          }
        }, 2000);
      });
    } catch (error: any) {
      console.error('STK Push initiation error:', error);
      throw new Error(`Payment initiation failed: ${error.message}`);
    }
  },

  async verifyTransaction(transactionCode: string) {
    try {
      if (!transactionCode || transactionCode.length < 5) {
        return { valid: false, error: 'Invalid transaction code' };
      }

      const sanitizedCode = SecurityUtils.sanitizeInput(transactionCode);

      // TODO: Implement actual M-Pesa verification via Daraja API
      // For now, simulate verification
      return await new Promise((resolve) => {
        setTimeout(() => {
          resolve({ 
            valid: true, 
            amount: 1000, 
            phoneNumber: '+254712345678',
            transactionDate: new Date().toISOString()
          });
        }, 1000);
      });
    } catch (error: any) {
      console.error('Transaction verification error:', error);
      return { valid: false, error: 'Verification failed' };
    }
  },

  async disburseFunds(phoneNumber: string, amount: number, reference: string) {
    try {
      // Validate inputs
      if (!await SecurityUtils.validatePhoneNumber(phoneNumber)) {
        throw new Error('Invalid phone number format');
      }

      if (amount <= 0 || amount > 150000) {
        throw new Error('Invalid amount');
      }

      const cleanPhone = this.cleanPhoneNumber(phoneNumber);
      const sanitizedReference = SecurityUtils.sanitizeInput(reference);

      // TODO: Implement B2C M-Pesa API for disbursements
      console.log('Disbursing funds:', {
        phoneNumber: cleanPhone,
        amount,
        reference: sanitizedReference
      });

      return { success: true, message: 'Disbursement initiated' };
    } catch (error: any) {
      console.error('Funds disbursement error:', error);
      throw new Error(`Disbursement failed: ${error.message}`);
    }
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

  private generateRequestId(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `WC${timestamp}${random}`.toUpperCase();
  },
};