import { supabase } from '../utils/supabase';

export const ContributionService = {
  async recordContribution(contributionData: {
    chama_id: string;
    member_id: string;
    amount: number;
    transaction_code?: string;
    payment_method: 'mpesa' | 'cash' | 'bank';
  }) {
    try {
      // Validate user permissions
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        return { success: false, error: 'Authentication required' };
      }

      // Verify user is member of this chama
      const { data: membership } = await supabase
        .from('chama_members')
        .select('role')
        .eq('chama_id', contributionData.chama_id)
        .eq('user_id', user.data.user.id)
        .single();

      if (!membership) {
        return { success: false, error: 'Not a member of this chama' };
      }

      // Validate amount
      if (contributionData.amount <= 0) {
        return { success: false, error: 'Amount must be positive' };
      }

      const { data, error } = await supabase
        .from('contributions')
        .insert([
          {
            ...contributionData,
            status: 'completed',
            contribution_date: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Contribution recording error:', error);
        return { success: false, error: 'Failed to record contribution' };
      }

      await this.updateChamaTotal(contributionData.chama_id);
      return { success: true, contribution: data };
    } catch (error: any) {
      console.error('Contribution recording unexpected error:', error);
      return { success: false, error: 'Failed to record contribution' };
    }
  },

  async getChamaContributions(chamaId: string) {
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
        .from('contributions')
        .select(`
          *,
          member:chama_members(
            user:users(full_name, profile_picture_url)
          )
        `)
        .eq('chama_id', chamaId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Contributions fetch error:', error);
        return { success: false, error: 'Failed to fetch contributions' };
      }

      return { success: true, contributions: data };
    } catch (error: any) {
      console.error('Contributions fetch unexpected error:', error);
      return { success: false, error: 'Failed to fetch contributions' };
    }
  },

  private async updateChamaTotal(chamaId: string) {
    try {
      const { data, error } = await supabase
        .from('contributions')
        .select('amount')
        .eq('chama_id', chamaId)
        .eq('status', 'completed');

      if (error) throw error;

      const total = data?.reduce((sum, contribution) => sum + contribution.amount, 0) || 0;

      await supabase
        .from('chamas')
        .update({ total_kitty: total })
        .eq('id', chamaId);
    } catch (error) {
      console.error('Chama total update error:', error);
    }
  },
};