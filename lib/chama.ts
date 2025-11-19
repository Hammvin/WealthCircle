import { supabase } from './supabase';

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
      if (!user.data.user) throw new Error('User not authenticated');

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

      if (error) throw error;

      await this.addMember(data.id, user.data.user.id, 'chairperson');
      return { success: true, chama: data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  async joinChama(inviteCode: string) {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error('User not authenticated');

      const { data: chama, error: chamaError } = await supabase
        .from('chamas')
        .select('*')
        .eq('invite_code', inviteCode)
        .single();

      if (chamaError) throw new Error('Invalid invite code');

      const { error: memberError } = await supabase
        .from('chama_members')
        .insert([
          {
            chama_id: chama.id,
            user_id: user.data.user.id,
            role: 'member',
          },
        ]);

      if (memberError) throw memberError;
      return { success: true, chama };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  async getUserChamas() {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('chama_members')
        .select(`
          chama:chamas(*),
          role
        `)
        .eq('user_id', user.data.user.id);

      if (error) throw error;
      return { success: true, chamas: data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  async getChamaDetails(chamaId: string) {
    try {
      const { data, error } = await supabase
        .from('chamas')
        .select(`
          *,
          members:chama_members(
            role,
            user:users(full_name, phone_number, profile_picture_url)
          )
        `)
        .eq('id', chamaId)
        .single();

      if (error) throw error;
      return { success: true, chama: data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  private async addMember(chamaId: string, userId: string, role: string) {
    const { error } = await supabase
      .from('chama_members')
      .insert([{ chama_id: chamaId, user_id: userId, role }]);

    if (error) throw error;
  },

  private generateInviteCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  },
};