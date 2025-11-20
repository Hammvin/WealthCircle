import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database.types';

// Security Configuration
const SECURITY_CONFIG = {
  MIN_AMOUNT: 1,
  MAX_AMOUNT: 1000000,
  MIN_PURPOSE_LENGTH: 5,
  MAX_PURPOSE_LENGTH: 500,
  RATE_LIMIT_WINDOW: 60000, // 1 minute
} as const;

// Type aliases for better readability
type PayoutRequest = Database['public']['Tables']['payout_requests']['Row'];
type PayoutRequestInsert = Database['public']['Tables']['payout_requests']['Insert'];
type PayoutVote = Database['public']['Tables']['payout_votes']['Row'];
type PayoutVoteInsert = Database['public']['Tables']['payout_votes']['Insert'];
type ChamaMember = Database['public']['Tables']['chama_members']['Row'];
type Chama = Database['public']['Tables']['chamas']['Row'];

// Rate limiting storage
const payoutAttempts = new Map<string, { count: number; lastAttempt: number }>();

// Security utilities
const SecurityUtils = {
  sanitizeInput(input: string, type: 'text' | 'number' | 'reference' = 'text'): string {
    let sanitized = input.trim();
    
    switch (type) {
      case 'number':
        sanitized = sanitized.replace(/[^\d.]/g, '');
        break;
      case 'reference':
        sanitized = sanitized
          .replace(/[<>"'`;\\/&|$#{}[\]=]/g, '')
          .substring(0, 100);
        break;
      default:
        sanitized = sanitized
          .replace(/[<>"'`;\\/&|$#{}[\]=]/g, '')
          .substring(0, SECURITY_CONFIG.MAX_PURPOSE_LENGTH);
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
const checkRateLimit = (identifier: string): { limited: boolean; message?: string } => {
  const now = Date.now();
  const attempt = payoutAttempts.get(identifier);
  
  if (!attempt) {
    payoutAttempts.set(identifier, { count: 1, lastAttempt: now });
    return { limited: false };
  }

  if (now - attempt.lastAttempt > SECURITY_CONFIG.RATE_LIMIT_WINDOW) {
    payoutAttempts.set(identifier, { count: 1, lastAttempt: now });
    return { limited: false };
  }

  if (attempt.count >= 5) {
    return { limited: true, message: 'Too many attempts. Please try again later.' };
  }

  payoutAttempts.set(identifier, { 
    count: attempt.count + 1, 
    lastAttempt: now 
  });
  
  return { limited: false };
};

const isValidUUID = (id: string): boolean => {
  if (!id) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

const verifyChamaMembership = async (chamaId: string, userId: string): Promise<{ isMember: boolean; membershipId?: string; role?: string }> => {
  try {
    const { data, error } = await supabase
      .from('chama_members')
      .select('id, role')
      .eq('chama_id', chamaId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return { isMember: false };
    }

    return { isMember: true, membershipId: data.id, role: data.role };
  } catch (error) {
    return { isMember: false };
  }
};

const checkVoteStatus = async (requestId: string): Promise<void> => {
  try {
    const { data: votes, error } = await supabase
      .from('payout_votes')
      .select('*')
      .eq('payout_request_id', requestId);

    if (error) throw error;

    const totalVotes = votes.length;
    const approveVotes = votes.filter(vote => vote.vote === 'approve').length;

    // Get total members in chama for quorum calculation
    const { data: request } = await supabase
      .from('payout_requests')
      .select('chama_id')
      .eq('id', requestId)
      .single();

    if (request) {
      const { data: members } = await supabase
        .from('chama_members')
        .select('id')
        .eq('chama_id', request.chama_id);

      const totalMembers = members?.length || 1;
      
      // Require majority of votes AND at least 50% member participation
      const participationRate = totalVotes / totalMembers;
      
      if (approveVotes > totalVotes / 2 && participationRate >= 0.5) {
        await supabase
          .from('payout_requests')
          .update({ status: 'approved' })
          .eq('id', requestId);
      } else if (totalVotes >= totalMembers) {
        // All members voted but didn't reach majority
        await supabase
          .from('payout_requests')
          .update({ status: 'rejected' })
          .eq('id', requestId);
      }
    }
  } catch (error) {
    console.error('Vote status check error:', error);
  }
};

interface PayoutRequestData {
  chama_id: string;
  amount: number;
  request_type: 'payout' | 'loan';
  purpose: string;
  interest_rate?: number;
  repayment_period?: number;
}

const validatePayoutRequest = (requestData: PayoutRequestData): { valid: boolean; error?: string } => {
  if (!requestData.chama_id || !isValidUUID(requestData.chama_id)) {
    return { valid: false, error: 'Invalid chama ID' };
  }

  const amountValidation = SecurityUtils.validateAmount(requestData.amount);
  if (!amountValidation.valid) {
    return { valid: false, error: amountValidation.error };
  }

  if (!requestData.request_type || !['payout', 'loan'].includes(requestData.request_type)) {
    return { valid: false, error: 'Invalid request type' };
  }

  if (!requestData.purpose || requestData.purpose.trim().length < SECURITY_CONFIG.MIN_PURPOSE_LENGTH) {
    return { valid: false, error: `Purpose must be at least ${SECURITY_CONFIG.MIN_PURPOSE_LENGTH} characters` };
  }

  if (requestData.purpose.length > SECURITY_CONFIG.MAX_PURPOSE_LENGTH) {
    return { valid: false, error: `Purpose too long (max ${SECURITY_CONFIG.MAX_PURPOSE_LENGTH} characters)` };
  }

  // Loan-specific validations
  if (requestData.request_type === 'loan') {
    if (!requestData.interest_rate || requestData.interest_rate < 0 || requestData.interest_rate > 100) {
      return { valid: false, error: 'Valid interest rate required (0-100%)' };
    }

    if (!requestData.repayment_period || requestData.repayment_period < 1 || requestData.repayment_period > 36) {
      return { valid: false, error: 'Valid repayment period required (1-36 months)' };
    }
  }

  return { valid: true };
};

export const PayoutService = {
  /**
   * Request payout with enhanced security
   */
  async requestPayout(requestData: PayoutRequestData) {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return { success: false, error: 'Authentication required' };
      }

      // Rate limiting
      const rateLimitCheck = checkRateLimit(`payoutRequest:${user.id}`);
      if (rateLimitCheck.limited) {
        return { success: false, error: rateLimitCheck.message };
      }

      // Input validation
      const validation = validatePayoutRequest(requestData);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      // Verify user is member of this chama
      const membership = await verifyChamaMembership(requestData.chama_id, user.id);
      if (!membership.isMember) {
        return { success: false, error: 'Not a member of this chama' };
      }

      // Check if chama has sufficient funds
      const { data: chama, error: chamaError } = await supabase
        .from('chamas')
        .select('total_kitty, contribution_amount')
        .eq('id', requestData.chama_id)
        .single();

      if (chamaError || !chama) {
        return { success: false, error: 'Chama not found' };
      }

      if (chama.total_kitty < requestData.amount) {
        return { success: false, error: 'Insufficient chama funds' };
      }

      // Security: Limit payout amount to reasonable multiple of contribution
      const maxPayout = chama.contribution_amount * 10; // Max 10x monthly contribution
      if (requestData.amount > maxPayout) {
        return { success: false, error: 'Payout amount exceeds maximum allowed' };
      }

      const sanitizedPurpose = SecurityUtils.sanitizeInput(requestData.purpose, 'text');

      const payoutRequestData: PayoutRequestInsert = {
        chama_id: requestData.chama_id,
        amount: requestData.amount,
        request_type: requestData.request_type,
        purpose: sanitizedPurpose,
        interest_rate: requestData.interest_rate,
        repayment_period: requestData.repayment_period,
        member_id: membership.membershipId!,
        status: 'pending',
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('payout_requests')
        .insert(payoutRequestData)
        .select()
        .single();

      if (error) {
        console.error('Payout request error:', error);
        return { success: false, error: 'Failed to create payout request' };
      }

      // Reset rate limit on success
      payoutAttempts.delete(`payoutRequest:${user.id}`);

      return { success: true, request: data };
    } catch (error: any) {
      console.error('Payout request unexpected error:', error);
      return { success: false, error: 'Failed to create payout request' };
    }
  },

  /**
   * Vote on payout with enhanced security
   */
  async voteOnPayout(requestId: string, vote: 'approve' | 'reject') {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return { success: false, error: 'Authentication required' };
      }

      // Input validation
      if (!requestId || !isValidUUID(requestId)) {
        return { success: false, error: 'Invalid request ID' };
      }

      if (!['approve', 'reject'].includes(vote)) {
        return { success: false, error: 'Invalid vote' };
      }

      // Rate limiting
      const rateLimitCheck = checkRateLimit(`vote:${user.id}`);
      if (rateLimitCheck.limited) {
        return { success: false, error: rateLimitCheck.message };
      }

      // Get payout request details
      const { data: payoutRequest, error: requestError } = await supabase
        .from('payout_requests')
        .select('chama_id, status')
        .eq('id', requestId)
        .single();

      if (requestError || !payoutRequest) {
        return { success: false, error: 'Payout request not found' };
      }

      // Check if request is still open for voting
      if (payoutRequest.status !== 'pending') {
        return { success: false, error: 'Voting is closed for this request' };
      }

      // Verify user is member of this chama
      const membership = await verifyChamaMembership(payoutRequest.chama_id, user.id);
      if (!membership.isMember) {
        return { success: false, error: 'Not authorized to vote' };
      }

      // Check if user already voted
      const { data: existingVote } = await supabase
        .from('payout_votes')
        .select('id')
        .eq('payout_request_id', requestId)
        .eq('member_id', membership.membershipId)
        .single();

      if (existingVote) {
        return { success: false, error: 'Already voted on this request' };
      }

      const voteData: PayoutVoteInsert = {
        payout_request_id: requestId,
        member_id: membership.membershipId!,
        vote: vote,
        voted_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('payout_votes')
        .insert(voteData);

      if (error) {
        console.error('Vote recording error:', error);
        return { success: false, error: 'Failed to record vote' };
      }

      // Check if request reached voting threshold
      await checkVoteStatus(requestId);

      // Reset rate limit on success
      payoutAttempts.delete(`vote:${user.id}`);

      return { success: true };
    } catch (error: any) {
      console.error('Vote unexpected error:', error);
      return { success: false, error: 'Failed to process vote' };
    }
  },

  /**
   * Get chama payouts with enhanced security
   */
  async getChamaPayouts(chamaId: string) {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return { success: false, error: 'Authentication required' };
      }

      // Input validation
      if (!chamaId || !isValidUUID(chamaId)) {
        return { success: false, error: 'Invalid chama ID' };
      }

      // Verify membership
      const membership = await verifyChamaMembership(chamaId, user.id);
      if (!membership.isMember) {
        return { success: false, error: 'Not authorized to view payouts' };
      }

      const { data, error } = await supabase
        .from('payout_requests')
        .select(`
          *,
          member:chama_members(
            user:users(full_name, phone_number)
          ),
          votes:payout_votes(
            vote,
            voted_at,
            member:chama_members(
              user:users(full_name)
            )
          )
        `)
        .eq('chama_id', chamaId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Payouts fetch error:', error);
        return { success: false, error: 'Failed to fetch payouts' };
      }

      return { success: true, payouts: data || [] };
    } catch (error: any) {
      console.error('Payouts fetch unexpected error:', error);
      return { success: false, error: 'Failed to fetch payouts' };
    }
  },

  /**
   * Get user's payout requests
   */
  async getUserPayouts() {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return { success: false, error: 'Authentication required' };
      }

      // Get user's memberships
      const { data: memberships, error: membershipsError } = await supabase
        .from('chama_members')
        .select('id')
        .eq('user_id', user.id);

      if (membershipsError) {
        return { success: false, error: 'Failed to fetch memberships' };
      }

      const membershipIds = memberships?.map(m => m.id) || [];

      if (membershipIds.length === 0) {
        return { success: true, payouts: [] };
      }

      const { data, error } = await supabase
        .from('payout_requests')
        .select(`
          *,
          chama:chamas(name),
          votes:payout_votes(count)
        `)
        .in('member_id', membershipIds)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('User payouts fetch error:', error);
        return { success: false, error: 'Failed to fetch payouts' };
      }

      return { success: true, payouts: data || [] };
    } catch (error: any) {
      console.error('User payouts fetch unexpected error:', error);
      return { success: false, error: 'Failed to fetch payouts' };
    }
  }
};