import { supabase } from '@/utils/supabase';

export const ChamaService = {
  async createChama(chamaData: {
    name: string;
    description?: string;
    savings_goal: string;
    contribution_cycle: 'weekly' | 'monthly';
    contribution_amount: number;
  }) {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        return { success: false, error: 'Authentication required' };
      }

      const inviteCode = this.generateInviteCode();

      const { data, error } = await supabase
        .from('chamas')
        .insert([
          {
            ...chamaData,
            created_by: user.data.user.id,
            invite_code: inviteCode,
          },
        ])
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      // Add creator as chairperson
      await this.addMember(data.id, user.data.user.id, 'chairperson');
      
      return { success: true, chama: data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  async getUserChamas() {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        return { success: false, error: 'Authentication required' };
      }

      const { data, error } = await supabase
        .from('chama_members')
        .select(`
          chama:chamas(*),
          role
        `)
        .eq('user_id', user.data.user.id);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, chamas: data?.map(item => item.chama) || [] };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  async addMember(chamaId: string, userId: string, role: string) {
    const { error } = await supabase
      .from('chama_members')
      .insert([{ chama_id: chamaId, user_id: userId, role }]);

    if (error) throw error;
  },

  private generateInviteCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  },
};