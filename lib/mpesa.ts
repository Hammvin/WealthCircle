import { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

// Security Configuration
const SECURITY_CONFIG = {
  MAX_AMOUNT: 150000, // M-Pesa limit
  MIN_AMOUNT: 1,
  MAX_PHONE_LENGTH: 16,
  MAX_REFERENCE_LENGTH: 50,
  MAX_TRANSACTION_CODE_LENGTH: 20,
  RATE_LIMIT_WINDOW: 60000, // 1 minute
} as const;

// Type definitions based on database schema
type Transaction = Database['public']['Tables']['transactions']['Row'];
type TransactionInsert = Database['public']['Tables']['transactions']['Insert'];
type TransactionLog = Database['public']['Tables']['transaction_logs']['Row'];
type TransactionLogInsert = Database['public']['Tables']['transaction_logs']['Insert'];
type DisbursementLog = Database['public']['Tables']['disbursement_logs']['Row'];
type DisbursementLogInsert = Database['public']['Tables']['disbursement_logs']['Insert'];
type ChamaMember = Database['public']['Tables']['chama_members']['Row'];

// Rate limiting storage
const transactionAttempts = new Map<string, { count: number; lastAttempt: number }>();

// Security utilities
const SecurityUtils = {
  async validatePhoneNumber(phoneNumber: string): Promise<boolean> {
    try {
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
    } catch (error) {
      return false;
    }
  },

  sanitizeInput(input: string, type: 'text' | 'phone' | 'number' | 'reference' = 'text'): string {
    let sanitized = input.trim();
    
    switch (type) {
      case 'phone':
        sanitized = sanitized
          .replace(/[<>"'`;\\/&|$#{}[\]=]/g, '')
          .substring(0, SECURITY_CONFIG.MAX_PHONE_LENGTH);
        break;
      case 'number':
        sanitized = sanitized.replace(/[^\d.]/g, '');
        break;
      case 'reference':
        sanitized = sanitized
          .replace(/[<>"'`;\\/&|$#{}[\]=]/g, '')
          .substring(0, SECURITY_CONFIG.MAX_REFERENCE_LENGTH);
        break;
      default:
        sanitized = sanitized
          .replace(/[<>"'`;\\/&|$#{}[\]=]/g, '')
          .substring(0, 100);
    }
    
    return sanitized;
  },

  validateAmount(amount: number): { valid: boolean; error?: string } {
    if (typeof amount !== 'number' || isNaN(amount)) {
      return { valid: false, error: 'Invalid amount format' };
    }

    if (amount < SECURITY_CONFIG.MIN_AMOUNT) {
      return { valid: false, error: `Amount must be at least ${SECURITY_CONFIG.MIN_AMOUNT} KES` };
    }

    if (amount > SECURITY_CONFIG.MAX_AMOUNT) {
      return { valid: false, error: `Amount cannot exceed ${SECURITY_CONFIG.MAX_AMOUNT} KES` };
    }

    return { valid: true };
  }
};

// Internal helper functions
const cleanPhoneNumber = (phone: string): string => {
  let clean = phone.replace(/\s+/g, '');
  if (clean.startsWith('0')) {
    clean = '+254' + clean.substring(1);
  } else if (!clean.startsWith('+')) {
    clean = '+254' + clean;
  }
  return clean;
};

const generateRequestId = (): string => {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8);
  return `WC${timestamp}${random}`.toUpperCase();
};

const isValidUUID = (id: string): boolean => {
  if (!id) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

const checkRateLimit = (identifier: string): { limited: boolean; message?: string } => {
  const now = Date.now();
  const attempt = transactionAttempts.get(identifier);
  
  if (!attempt) {
    transactionAttempts.set(identifier, { count: 1, lastAttempt: now });
    return { limited: false };
  }

  // Reset counter if more than time window has passed
  if (now - attempt.lastAttempt > SECURITY_CONFIG.RATE_LIMIT_WINDOW) {
    transactionAttempts.set(identifier, { count: 1, lastAttempt: now });
    return { limited: false };
  }

  // Check attempts (max 5 per minute)
  if (attempt.count >= 5) {
    return { limited: true, message: 'Too many attempts. Please try again later.' };
  }

  transactionAttempts.set(identifier, { 
    count: attempt.count + 1, 
    lastAttempt: now 
  });
  
  return { limited: false };
};

const validateTransaction = async (transactionCode: string, amount: number, phoneNumber: string): Promise<{ valid: boolean; error?: string; amount?: number; phoneNumber?: string; transactionDate?: string }> => {
  try {
    // Security: Check for duplicate transaction
    const { data: existingTransaction, error: queryError } = await supabase
      .from('transactions')
      .select('id')
      .eq('transaction_code', transactionCode)
      .single();

    if (queryError && queryError.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Transaction query error:', queryError);
      return { valid: false, error: 'Transaction verification service unavailable' };
    }

    if (existingTransaction) {
      return { valid: false, error: 'This transaction has already been processed' };
    }

    // TODO: Implement actual M-Pesa verification logic here
    // For now, simulate successful verification with security checks
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate verification failure for testing (10% failure rate)
    if (Math.random() < 0.1) {
      return { valid: false, error: 'Transaction verification failed' };
    }

    return { 
      valid: true, 
      amount, 
      phoneNumber,
      transactionDate: new Date().toISOString()
    };
  } catch (error) {
    console.error('Transaction validation error:', error);
    return { valid: false, error: 'Transaction verification service unavailable' };
  }
};

const verifyChamaMembership = async (chamaId: string, userId: string): Promise<{ isMember: boolean; role?: string }> => {
  try {
    const { data, error } = await supabase
      .from('chama_members')
      .select('role')
      .eq('chama_id', chamaId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return { isMember: false };
    }

    return { isMember: true, role: data.role };
  } catch (error) {
    return { isMember: false };
  }
};

const verifyDisbursementAuthorization = async (chamaId: string, userId: string): Promise<{ authorized: boolean; error?: string }> => {
  try {
    const membership = await verifyChamaMembership(chamaId, userId);
    
    if (!membership.isMember) {
      return { authorized: false, error: 'Not a member of this chama' };
    }

    if (!['chairperson', 'treasurer'].includes(membership.role || '')) {
      return { authorized: false, error: 'Only chairpersons and treasurers can disburse funds' };
    }

    return { authorized: true };
  } catch (error) {
    return { authorized: false, error: 'Authorization check failed' };
  }
};

export const MpesaService = {
  /**
   * Initiate STK Push with enhanced security
   */
  async initiateSTKPush(phoneNumber: string, amount: number, chamaId: string, userId: string) {
    try {
      // Input validation
      if (!phoneNumber || !chamaId || !userId) {
        throw new Error('Phone number, chama ID, and user ID are required');
      }

      // Rate limiting
      const rateLimitCheck = checkRateLimit(`stkpush:${userId}`);
      if (rateLimitCheck.limited) {
        throw new Error(rateLimitCheck.message);
      }

      // Phone number validation
      if (!await SecurityUtils.validatePhoneNumber(phoneNumber)) {
        throw new Error('Invalid Kenyan phone number format');
      }

      // Amount validation
      const amountValidation = SecurityUtils.validateAmount(amount);
      if (!amountValidation.valid) {
        throw new Error(amountValidation.error);
      }

      // UUID validation
      if (!isValidUUID(chamaId) || !isValidUUID(userId)) {
        throw new Error('Invalid request parameters');
      }

      const cleanPhone = cleanPhoneNumber(phoneNumber);
      const sanitizedChamaId = SecurityUtils.sanitizeInput(chamaId, 'text');

      // Verify user is member of the chama
      const membership = await verifyChamaMembership(sanitizedChamaId, userId);
      if (!membership.isMember) {
        throw new Error('Unauthorized: Not a member of this chama');
      }

      // Log transaction attempt for audit trail
      const requestId = generateRequestId();
      const transactionLogData: TransactionLogInsert = {
        user_id: userId,
        chama_id: sanitizedChamaId,
        phone_number: cleanPhone,
        amount: amount,
        status: 'pending',
        request_id: requestId,
        created_at: new Date().toISOString()
      };

      const { error: logError } = await supabase
        .from('transaction_logs')
        .insert(transactionLogData);

      if (logError) {
        console.error('Failed to log transaction attempt:', logError);
        throw new Error('Transaction logging failed');
      }

      // TODO: Integrate with Africa's Talking or Daraja API
      console.log('Initiating STK Push:', { 
        phoneNumber: cleanPhone, 
        amount, 
        chamaId: sanitizedChamaId,
        userId,
        requestId
      });
      
      // Simulate API call with timeout and security
      return await new Promise((resolve, reject) => {
        setTimeout(() => {
          // Simulate random failures for testing
          if (Math.random() < 0.1) {
            reject(new Error('Network error occurred. Please try again.'));
          } else {
            resolve({ 
              success: true, 
              message: 'Payment request sent successfully',
              requestId: requestId
            });
          }
        }, 2000);
      });
    } catch (error: any) {
      console.error('STK Push initiation error:', error);
      throw new Error(`Payment initiation failed: ${error.message}`);
    }
  },

  /**
   * Verify transaction with enhanced security
   */
  async verifyTransaction(transactionCode: string, amount: number, phoneNumber: string, userId: string) {
    try {
      if (!transactionCode || transactionCode.length < 5) {
        return { valid: false, error: 'Invalid transaction code' };
      }

      // Rate limiting
      const rateLimitCheck = checkRateLimit(`verify:${userId}`);
      if (rateLimitCheck.limited) {
        return { valid: false, error: rateLimitCheck.message };
      }

      const sanitizedCode = SecurityUtils.sanitizeInput(transactionCode, 'text');
      const cleanPhone = cleanPhoneNumber(phoneNumber);

      // Validate phone number
      if (!await SecurityUtils.validatePhoneNumber(cleanPhone)) {
        return { valid: false, error: 'Invalid phone number' };
      }

      // Validate amount
      const amountValidation = SecurityUtils.validateAmount(amount);
      if (!amountValidation.valid) {
        return { valid: false, error: amountValidation.error };
      }

      // UUID validation
      if (!isValidUUID(userId)) {
        return { valid: false, error: 'Invalid user ID' };
      }

      // Verify transaction
      const verificationResult = await validateTransaction(sanitizedCode, amount, cleanPhone);
      
      if (verificationResult.valid) {
        try {
          // Log successful verification
          const { error: updateError } = await supabase
            .from('transaction_logs')
            .update({
              status: 'verified',
              transaction_code: sanitizedCode,
              verified_at: new Date().toISOString()
            })
            .eq('phone_number', cleanPhone)
            .eq('amount', amount)
            .eq('status', 'pending');

          if (updateError) {
            console.error('Failed to update transaction log:', updateError);
          }

          // Create actual transaction record
          const transactionData: TransactionInsert = {
            user_id: userId,
            phone_number: cleanPhone,
            amount: amount,
            transaction_code: sanitizedCode,
            status: 'completed',
            created_at: new Date().toISOString()
          };

          const { error: transactionError } = await supabase
            .from('transactions')
            .insert(transactionData);

          if (transactionError) {
            console.error('Failed to create transaction record:', transactionError);
          }
        } catch (logError) {
          console.error('Transaction logging error:', logError);
          // Don't fail verification if logging fails
        }
      }

      return verificationResult;
    } catch (error: any) {
      console.error('Transaction verification error:', error);
      return { valid: false, error: 'Verification failed. Please try again.' };
    }
  },

  /**
   * Disburse funds with enhanced security
   */
  async disburseFunds(phoneNumber: string, amount: number, reference: string, userId: string, chamaId: string) {
    try {
      // Input validation
      if (!phoneNumber || !reference || !userId || !chamaId) {
        throw new Error('All fields are required');
      }

      // Rate limiting
      const rateLimitCheck = checkRateLimit(`disburse:${userId}`);
      if (rateLimitCheck.limited) {
        throw new Error(rateLimitCheck.message);
      }

      // Phone number validation
      if (!await SecurityUtils.validatePhoneNumber(phoneNumber)) {
        throw new Error('Invalid Kenyan phone number format');
      }

      // Amount validation
      const amountValidation = SecurityUtils.validateAmount(amount);
      if (!amountValidation.valid) {
        throw new Error(amountValidation.error);
      }

      // Reference validation
      if (reference.length < 3 || reference.length > SECURITY_CONFIG.MAX_REFERENCE_LENGTH) {
        throw new Error('Reference must be between 3 and 50 characters');
      }

      // UUID validation
      if (!isValidUUID(userId) || !isValidUUID(chamaId)) {
        throw new Error('Invalid request parameters');
      }

      // Authorization check
      const authorization = await verifyDisbursementAuthorization(chamaId, userId);
      if (!authorization.authorized) {
        throw new Error(authorization.error || 'Unauthorized action');
      }

      const cleanPhone = cleanPhoneNumber(phoneNumber);
      const sanitizedReference = SecurityUtils.sanitizeInput(reference, 'reference');

      // Log disbursement attempt
      const disbursementData: DisbursementLogInsert = {
        chama_id: chamaId,
        initiated_by: userId,
        phone_number: cleanPhone,
        amount: amount,
        reference: sanitizedReference,
        status: 'pending',
        created_at: new Date().toISOString()
      };

      const { error: logError } = await supabase
        .from('disbursement_logs')
        .insert(disbursementData);

      if (logError) {
        console.error('Failed to log disbursement attempt:', logError);
        throw new Error('Disbursement logging failed');
      }

      // TODO: Implement B2C M-Pesa API for disbursements
      console.log('Disbursing funds:', {
        phoneNumber: cleanPhone,
        amount,
        reference: sanitizedReference,
        chamaId,
        initiatedBy: userId
      });

      return { 
        success: true, 
        message: 'Disbursement initiated successfully',
        reference: sanitizedReference,
        disbursementId: generateRequestId()
      };
    } catch (error: any) {
      console.error('Funds disbursement error:', error);
      throw new Error(`Disbursement failed: ${error.message}`);
    }
  },

  /**
   * Get transaction history for a user with security
   */
  async getTransactionHistory(userId: string, limit: number = 10) {
    try {
      if (!userId) {
        throw new Error('User ID required');
      }

      // UUID validation
      if (!isValidUUID(userId)) {
        throw new Error('Invalid user ID');
      }

      // Limit validation
      const safeLimit = Math.min(Math.max(1, limit), 50); // Between 1 and 50

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(safeLimit);

      if (error) {
        console.error('Transaction history error:', error);
        throw new Error('Failed to fetch transaction history');
      }

      return { success: true, transactions: data || [] };
    } catch (error: any) {
      console.error('Transaction history error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Check transaction status
   */
  async checkTransactionStatus(requestId: string, userId: string) {
    try {
      if (!requestId || !userId) {
        return { success: false, error: 'Request ID and user ID required' };
      }

      // UUID validation
      if (!isValidUUID(userId)) {
        return { success: false, error: 'Invalid user ID' };
      }

      const sanitizedRequestId = SecurityUtils.sanitizeInput(requestId, 'text');

      const { data, error } = await supabase
        .from('transaction_logs')
        .select('status, transaction_code, verified_at, amount, phone_number')
        .eq('request_id', sanitizedRequestId)
        .eq('user_id', userId)
        .single();

      if (error) {
        return { success: false, error: 'Transaction not found' };
      }

      return { success: true, transaction: data };
    } catch (error: any) {
      console.error('Transaction status check error:', error);
      return { success: false, error: 'Failed to check transaction status' };
    }
  }
};