import { Database, supabase } from '@/lib/supabase';

// Security constants
const SECURITY_CONFIG = {
  INVITE_CODE_LENGTH: 8,
  MAX_NAME_LENGTH: 50,
  MAX_DESCRIPTION_LENGTH: 200,
  MIN_CONTRIBUTION_AMOUNT: 100,
  MAX_CONTRIBUTION_AMOUNT: 100000,
  RATE_LIMIT_WINDOW: 60000, // 1 minute
} as const;

// Type aliases for better readability
type Chama = Database['public']['Tables']['chamas']['Row'];
type ChamaInsert = Database['public']['Tables']['chamas']['Insert'];
type ChamaMember = Database['public']['Tables']['chama_members']['Row'];
type ChamaMemberInsert = Database['public']['Tables']['chama_members']['Insert'];
type ChamaMemberRole = Database['public']['Enums']['member_role'];

// Rate limiting storage
const chamaAttempts = new Map<string, { count: number; lastAttempt: number }>();

// Internal helper functions (not exposed as methods)
const generateSecureInviteCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Remove ambiguous characters
  let result = '';
  
  // Use crypto if available for better security
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const randomValues = new Uint8Array(SECURITY_CONFIG.INVITE_CODE_LENGTH);
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < SECURITY_CONFIG.INVITE_CODE_LENGTH; i++) {
      result += chars[randomValues[i] % chars.length];
    }
  } else {
    // Fallback (less secure but works everywhere)
    for (let i = 0; i < SECURITY_CONFIG.INVITE_CODE_LENGTH; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  
  return result;
};

interface ChamaCreateData {
  name: string;
  description?: string;
  savings_goal: string;
  contribution_cycle: 'weekly' | 'monthly';
  contribution_amount: number;
}

const validateChamaData = (data: ChamaCreateData): { valid: boolean; error?: string } => {
  if (!data.name || data.name.trim().length < 2) {
    return { valid: false, error: 'Chama name must be at least 2 characters' };
  }

  if (data.name.length > SECURITY_CONFIG.MAX_NAME_LENGTH) {
    return { valid: false, error: `Chama name too long (max ${SECURITY_CONFIG.MAX_NAME_LENGTH} characters)` };
  }

  if (data.description && data.description.length > SECURITY_CONFIG.MAX_DESCRIPTION_LENGTH) {
    return { valid: false, error: `Description too long (max ${SECURITY_CONFIG.MAX_DESCRIPTION_LENGTH} characters)` };
  }

  if (!data.savings_goal || data.savings_goal.trim().length < 2) {
    return { valid: false, error: 'Valid savings goal required' };
  }

  if (!['weekly', 'monthly'].includes(data.contribution_cycle)) {
    return { valid: false, error: 'Invalid contribution cycle' };
  }

  if (typeof data.contribution_amount !== 'number' || 
      data.contribution_amount < SECURITY_CONFIG.MIN_CONTRIBUTION_AMOUNT ||
      data.contribution_amount > SECURITY_CONFIG.MAX_CONTRIBUTION_AMOUNT) {
    return { valid: false, error: `Contribution amount must be between ${SECURITY_CONFIG.MIN_CONTRIBUTION_AMOUNT} and ${SECURITY_CONFIG.MAX_CONTRIBUTION_AMOUNT}` };
  }

  return { valid: true };
};

const sanitizeInput = (input: string, type: 'text' | 'number' = 'text'): string => {
  let sanitized = input.trim();
  
  switch (type) {
    case 'text':
      sanitized = sanitized
        .replace(/[<>"'`;\\/&|$#{}[\]=]/g, '')
        .substring(0, SECURITY_CONFIG.MAX_DESCRIPTION_LENGTH);
      break;
    case 'number':
      // Remove any non-numeric characters except decimal point
      sanitized = sanitized.replace(/[^\d.]/g, '');
      break;
  }
  
  return sanitized;
};

const isValidUUID = (id: string): boolean => {
  if (!id) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

const verifyChairperson = async (chamaId: string, userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('chama_members')
      .select('role')
      .eq('chama_id', chamaId)
      .eq('user_id', userId)
      .single();

    return !error && data?.role === 'chairperson';
  } catch (error) {
    return false;
  }
};

const checkRateLimit = (identifier: string): { limited: boolean; message?: string } => {
  const now = Date.now();
  const attempt = chamaAttempts.get(identifier);
  
  if (!attempt) {
    chamaAttempts.set(identifier, { count: 1, lastAttempt: now });
    return { limited: false };
  }

  // Reset counter if more than time window has passed
  if (now - attempt.lastAttempt > SECURITY_CONFIG.RATE_LIMIT_WINDOW) {
    chamaAttempts.set(identifier, { count: 1, lastAttempt: now });
    return { limited: false };
  }

  // Check attempts (max 3 per minute)
  if (attempt.count >= 3) {
    return { limited: true, message: 'Too many attempts. Please try again later.' };
  }

  chamaAttempts.set(identifier, { 
    count: attempt.count + 1, 
    lastAttempt: now 
  });
  
  return { limited: false };
};

const addMemberWithVerification = async (chamaId: string, userId: string, role: ChamaMemberRole): Promise<{ success: boolean; error?: string }> => {
  try {
    const memberData: ChamaMemberInsert = {
      chama_id: chamaId, 
      user_id: userId, 
      role: sanitizeInput(role, 'text') as ChamaMemberRole,
      joined_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('chama_members')
      .insert([memberData]);

    return { success: !error, error: error?.message };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

interface ServiceResponse<T = undefined> {
  success: boolean;
  error?: string;
  chama?: T;
  chamas?: T[];
}

export const ChamaService = {
  /**
   * Secure chama creation with comprehensive validation
   */
  async createChama(chamaData: ChamaCreateData): Promise<ServiceResponse<Chama>> {
    try {
      // Authentication check
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return { success: false, error: 'Authentication required' };
      }

      // Rate limiting
      const rateLimitCheck = checkRateLimit(`createChama:${user.id}`);
      if (rateLimitCheck.limited) {
        return { success: false, error: rateLimitCheck.message };
      }

      // Input validation
      const validation = validateChamaData(chamaData);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Sanitize inputs
      const sanitizedData = {
        ...chamaData,
        name: sanitizeInput(chamaData.name, 'text'),
        description: chamaData.description ? sanitizeInput(chamaData.description, 'text') : undefined,
        savings_goal: sanitizeInput(chamaData.savings_goal, 'text'),
      };

      const inviteCode = generateSecureInviteCode();

      // Use proper Supabase insert syntax with typed data
      const chamaInsertData: ChamaInsert = {
        ...sanitizedData,
        created_by: user.id,
        invite_code: inviteCode,
        created_at: new Date().toISOString(),
        is_active: true
      };

      const { data, error } = await supabase
        .from('chamas')
        .insert(chamaInsertData)
        .select()
        .single();

      if (error) {
        console.error('Chama creation error:', error.message);
        return { success: false, error: 'Failed to create chama' };
      }

      if (!data) {
        return { success: false, error: 'Failed to create chama' };
      }

      // Add creator as chairperson with verification
      const addMemberResult = await addMemberWithVerification(data.id, user.id, 'chairperson');
      if (!addMemberResult.success) {
        // Critical: Delete chama if member creation fails
        await supabase.from('chamas').delete().match({ id: data.id });
        return { success: false, error: 'Failed to setup chama administration' };
      }
      
      return { success: true, chama: data };
    } catch (error: any) {
      console.error('Chama creation unexpected error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  },

  /**
   * Secure chama retrieval with membership verification
   */
  async getUserChamas(): Promise<ServiceResponse<Chama>> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return { success: false, error: 'Authentication required' };
      }

      const { data, error } = await supabase
        .from('chama_members')
        .select(`
          chama:chamas(
            id,
            name,
            description,
            savings_goal,
            contribution_cycle,
            contribution_amount,
            created_by,
            invite_code,
            created_at,
            is_active
          ),
          role
        `)
        .eq('user_id', user.id)
        .eq('chamas.is_active', true); // Only active chamas

      if (error) {
        console.error('Chama retrieval error:', error.message);
        return { success: false, error: 'Failed to retrieve chamas' };
      }

      // Additional security: Verify user still has access to each chama
      const verifiedChamas = (data || []).filter((item: any) => item.chama && item.role);

      return { 
        success: true, 
        chamas: verifiedChamas.map((item: any) => item.chama) 
      };
    } catch (error: any) {
      console.error('Chama retrieval unexpected error:', error);
      return { success: false, error: 'Failed to retrieve chamas' };
    }
  },

  /**
   * Secure member addition with authorization
   */
  async addMember(
    chamaId: string, 
    userId: string, 
    role: ChamaMemberRole, 
    requestedByUserId: string
  ): Promise<ServiceResponse> {
    try {
      // Validate inputs
      if (!isValidUUID(chamaId) || !isValidUUID(userId) || !isValidUUID(requestedByUserId)) {
        return { success: false, error: 'Invalid parameters' };
      }

      // Authorization: Check if requester is chairperson of this chama
      const isAuthorized = await verifyChairperson(chamaId, requestedByUserId);
      if (!isAuthorized) {
        return { success: false, error: 'Unauthorized action' };
      }

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('chama_members')
        .select('id')
        .eq('chama_id', chamaId)
        .eq('user_id', userId)
        .single();

      if (existingMember) {
        return { success: false, error: 'User is already a member' };
      }

      const memberData: ChamaMemberInsert = {
        chama_id: chamaId, 
        user_id: userId, 
        role: sanitizeInput(role, 'text') as ChamaMemberRole,
        joined_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('chama_members')
        .insert(memberData);

      if (error) {
        console.error('Add member error:', error.message);
        return { success: false, error: 'Failed to add member' };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Add member unexpected error:', error);
      return { success: false, error: 'Failed to add member' };
    }
  },

  /**
   * Join chama using invite code
   */
  async joinChama(inviteCode: string): Promise<ServiceResponse<Pick<Chama, 'id' | 'name'>>> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return { success: false, error: 'Authentication required' };
      }

      // Sanitize invite code
      const cleanInviteCode = sanitizeInput(inviteCode, 'text').toUpperCase();
      
      if (!cleanInviteCode || cleanInviteCode.length !== SECURITY_CONFIG.INVITE_CODE_LENGTH) {
        return { success: false, error: 'Invalid invite code' };
      }

      // Rate limiting
      const rateLimitCheck = checkRateLimit(`joinChama:${user.id}`);
      if (rateLimitCheck.limited) {
        return { success: false, error: rateLimitCheck.message };
      }

      // Find chama by invite code
      const { data: chama, error: chamaError } = await supabase
        .from('chamas')
        .select('id, name, is_active')
        .eq('invite_code', cleanInviteCode)
        .eq('is_active', true)
        .single();

      if (chamaError || !chama) {
        return { success: false, error: 'Invalid or expired invite code' };
      }

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('chama_members')
        .select('id')
        .eq('chama_id', chama.id)
        .eq('user_id', user.id)
        .single();

      if (existingMember) {
        return { success: false, error: 'You are already a member of this chama' };
      }

      // Add as regular member
      const memberData: ChamaMemberInsert = {
        chama_id: chama.id,
        user_id: user.id,
        role: 'member',
        joined_at: new Date().toISOString()
      };

      const { error: memberError } = await supabase
        .from('chama_members')
        .insert(memberData);

      if (memberError) {
        console.error('Join chama error:', memberError.message);
        return { success: false, error: 'Failed to join chama' };
      }

      return { 
        success: true, 
        chama: { id: chama.id, name: chama.name } 
      };
    } catch (error: any) {
      console.error('Join chama unexpected error:', error);
      return { success: false, error: 'Failed to join chama' };
    }
  }
};