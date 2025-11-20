import { handleSupabaseError, supabase } from '@/utils/supabase';

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

      if (error) {
        return handleSupabaseError(error, 'recordContribution');
      }

      return { success: true, contribution: data };
    } catch (error: any) {
      return handleSupabaseError(error, 'recordContribution');
    }
  },

  async getChamaContributions(chamaId: string) {
    try {
      const { data, error } = await supabase
        .from('contributions')
        .select(`
          *,
          member:chama_members(
            user:users(full_name)
          )
        `)
        .eq('chama_id', chamaId)
        .order('created_at', { ascending: false });

      if (error) {
        return handleSupabaseError(error, 'getChamaContributions');
      }

      return { success: true, contributions: data };
    } catch (error: any) {
      return handleSupabaseError(error, 'getChamaContributions');
    }
  },
};