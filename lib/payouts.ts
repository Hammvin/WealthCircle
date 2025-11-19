import { SecurityUtils } from '@/utils/security';
import { supabase } from '../utils/supabase';

export const PayoutService = {
  async requestPayout(requestData: {
    chama_id: string;
    amount: number;
    request_type: 'payout' | 'loan';
    purpose: string;
    interest_rate?: number;
    repayment_period?: number;
  }) {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        return { success: false, error: 'Authentication required' };
      }

      // Validate input
      if (requestData.amount <= 0) {
        return { success: false, error: 'Amount must be positive' };
      }

      if (!requestData.purpose || requestData.purpose.length < 5) {
        return { success: false, error: 'Purpose must be at least 5 characters' };
      }

      // Verify user is member of this chama
      const { data: membership } = await supabase
        .from('chama_members')
        .select('id')
        .eq('chama_id', requestData.chama_id)
        .eq('user_id', user.data.user.id)
        .single();

      if (!membership) {
        return { success: false, error: 'Not a member of this chama' };
      }

      // Check if chama has sufficient funds
      const { data: chama } = await supabase
        .from('chamas')
        .select('total_kitty')
        .eq('id', requestData.chama_id)
        .single();

      if (!chama || chama.total_kitty < requestData.amount) {
        return { success: false, error: 'Insufficient chama funds' };
      }

      const sanitizedPurpose = SecurityUtils.sanitizeInput(requestData.purpose);

      const { data, error } = await supabase
        .from('payout_requests')
        .insert([
          {
            ...requestData,
            member_id: membership.id,
            purpose: sanitizedPurpose,
            status: 'pending',
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Payout request error:', error);
        return { success: false, error: 'Failed to create payout request' };
      }

      return { success: true, request: data };
    } catch (error: any) {
      console.error('Payout request unexpected error:', error);
      return { success: false, error: 'Failed to create payout request' };
    }
  },

  async voteOnPayout(requestId: string, vote: 'approve' | 'reject') {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        return { success: false, error: 'Authentication required' };
      }

      // Get payout request details
      const { data: payoutRequest } = await supabase
        .from('payout_requests')
        .select('chama_id')
        .eq('id', requestId)
        .single();

      if (!payoutRequest) {
        return { success: false, error: 'Payout request not found' };
      }

      // Verify user is member of this chama
      const { data: membership } = await supabase
        .from('chama_members')
        .select('id')
        .eq('chama_id', payoutRequest.chama_id)
        .eq('user_id', user.data.user.id)
        .single();

      if (!membership) {
        return { success: false, error: 'Not authorized to vote' };
      }

      // Check if user already voted
      const { data: existingVote } = await supabase
        .from('payout_votes')
        .select('id')
        .eq('payout_request_id', requestId)
        .eq('member_id', membership.id)
        .single();

      if (existingVote) {
        return { success: false, error: 'Already voted on this request' };
      }

      const { error } = await supabase
        .from('payout_votes')
        .insert([
          {
            payout_request_id: requestId,
            member_id: membership.id,
            vote: vote,
          },
        ]);

      if (error) {
        console.error('Vote recording error:', error);
        return { success: false, error: 'Failed to record vote' };
      }

      // Check if request reached majority
      await this.checkVoteStatus(requestId);
      return { success: true };
    } catch (error: any) {
      console.error('Vote unexpected error:', error);
      return { success: false, error: 'Failed to process vote' };
    }
  },

  async getChamaPayouts(chamaId: string) {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        return { success: false, error: 'Authentication required' };
      }

      // Verify membership
      const { data: membership } = await supabase
        .from('chama_members')
        .select('id')
        .eq('chama_id', chamaId)
        .eq('user_id', user.data.user.id)
        .single();

      if (!membership) {
        return { success: false, error: 'Not authorized' };
      }

      const { data, error } = await supabase
        .from('payout_requests')
        .select(`
          *,
          member:chama_members(
            user:users(full_name, profile_picture_url)
          ),
          votes:payout_votes(
            vote,
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

      return { success: true, payouts: data };
    } catch (error: any) {
      console.error('Payouts fetch unexpected error:', error);
      return { success: false, error: 'Failed to fetch payouts' };
    }
  },

  private async checkVoteStatus(requestId: string) {
    try {
      const { data: votes, error } = await supabase
        .from('payout_votes')
        .select('*')
        .eq('payout_request_id', requestId);

      if (error) throw error;

      const totalVotes = votes.length;
      const approveVotes = votes.filter(vote => vote.vote === 'approve').length;

      // Simple majority rule (50% + 1)
      if (approveVotes > totalVotes / 2) {
        await supabase
          .from('payout_requests')
          .update({ status: 'approved' })
          .eq('id', requestId);
      }
    } catch (error) {
      console.error('Vote status check error:', error);
    }
  },
};