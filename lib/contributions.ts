import { supabase } from './supabase';

export const ContributionService = {
  async recordContribution(contributionData: {
    chama_id: string;
    member_id: string;
    amount: number;
    transaction_code?: string;
    payment_method: 'mpesa' | 'cash' | 'bank';
  }) {
    try {
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

      if (error) throw error;
      await this.updateChamaTotal(contributionData.chama_id);
      return { success: true, contribution: data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  async getChamaContributions(chamaId: string) {
    try {
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

      if (error) throw error;
      return { success: true, contributions: data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  private async updateChamaTotal(chamaId: string) {
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
  },
};