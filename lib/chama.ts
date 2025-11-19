import { SecurityUtils } from '@/utils/security';
import { supabase } from '../utils/supabase';

// Private helper functions (not methods)
const addMember = async (chamaId: string, userId: string, role: string) => {
  const { error } = await supabase
    .from('chama_members')
    .insert([{ chama_id: chamaId, user_id: userId, role }]);

  if (error) throw error;
};

const generateSecureInviteCode = (): string => {
  // Generate cryptographically secure invite code
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  const randomValues = new Uint32Array(6);
  
  crypto.getRandomValues(randomValues);
  
  for (let i = 0; i < 6; i++) {
    code += chars[randomValues[i] % chars.length];
  }
  
  return code;
};

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

      // Input validation
      if (!chamaData.name || chamaData.name.length < 2) {
        return { success: false, error: 'Chama name must be at least 2 characters' };
      }

      if (chamaData.contribution_amount <= 0) {
        return { success: false, error: 'Contribution amount must be positive' };
      }

      const sanitizedName = SecurityUtils.sanitizeInput(chamaData.name);
      const sanitizedGoal = SecurityUtils.sanitizeInput(chamaData.savings_goal);

      const inviteCode = generateSecureInviteCode();

      const { data, error } = await supabase
        .from('chamas')
        .insert([
          {
            name: sanitizedName,
            savings_goal: sanitizedGoal,
            contribution_cycle: chamaData.contribution_cycle,
            contribution_amount: chamaData.contribution_amount,
            created_by: user.data.user.id,
            invite_code: inviteCode,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Chama creation error:', error);
        return { success: false, error: 'Failed to create chama' };
      }

      await addMember(data.id, user.data.user.id, 'chairperson');
      return { success: true, chama: data };
    } catch (error: any) {
      console.error('Chama creation unexpected error:', error);
      return { success: false, error: 'Chama creation failed' };
    }
  },

  async joinChama(inviteCode: string) {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        return { success: false, error: 'Authentication required' };
      }

      if (!inviteCode || inviteCode.length !== 6) {
        return { success: false, error: 'Invalid invite code' };
      }

      const { data: chama, error: chamaError } = await supabase
        .from('chamas')
        .select('*')
        .eq('invite_code', SecurityUtils.sanitizeInput(inviteCode))
        .single();

      if (chamaError) {
        return { success: false, error: 'Invalid invite code' };
      }

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('chama_members')
        .select('id')
        .eq('chama_id', chama.id)
        .eq('user_id', user.data.user.id)
        .single();

      if (existingMember) {
        return { success: false, error: 'Already a member of this chama' };
      }

      const { error: memberError } = await supabase
        .from('chama_members')
        .insert([
          {
            chama_id: chama.id,
            user_id: user.data.user.id,
            role: 'member',
          },
        ]);

      if (memberError) {
        console.error('Join chama error:', memberError);
        return { success: false, error: 'Failed to join chama' };
      }

      return { success: true, chama };
    } catch (error: any) {
      console.error('Join chama unexpected error:', error);
      return { success: false, error: 'Failed to join chama' };
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
        console.error('Error fetching user chamas:', error);
        return { success: false, error: 'Failed to fetch your chamas' };
      }

      return { success: true, chamas: data?.map(item => item.chama) || [] };
    } catch (error: any) {
      console.error('Unexpected error in getUserChamas:', error);
      return { success: false, error: 'Failed to fetch your chamas' };
    }
  },

  async getChamaDetails(chamaId: string) {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        return { success: false, error: 'Authentication required' };
      }

      // Verify user is member of this chama
      const { data: membership } = await supabase
        .from('chama_members')
        .select('id')
        .eq('chama_id', chamaId)
        .eq('user_id', user.data.user.id)
        .single();

      if (!membership) {
        return { success: false, error: 'Not authorized to view this chama' };
      }

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

      if (error) {
        console.error('Chama details fetch error:', error);
        return { success: false, error: 'Failed to fetch chama details' };
      }

      return { success: true, chama: data };
    } catch (error: any) {
      console.error('Chama details unexpected error:', error);
      return { success: false, error: 'Failed to fetch chama details' };
    }
  },
};