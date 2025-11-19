import { handleDatabaseError, supabase } from '../utils/supabase';

export interface Chama {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  member_count: number;
  total_contributions: number;
  status: 'active' | 'inactive' | 'suspended';
}

export interface ChamaMember {
  id: string;
  chama_id: string;
  user_id: string;
  role: 'admin' | 'member' | 'treasurer';
  joined_at: string;
  status: 'active' | 'inactive';
}

class ChamaService {
  /**
   * Get all chamas for a specific user - FIXED VERSION
   */
  async getUserChamas(userId: string): Promise<{ success: boolean; data?: Chama[]; error?: string }> {
    try {
      if (!userId) {
        return { success: false, error: 'User ID is required' };
      }

      console.log('Fetching chamas for user:', userId);

      // Use a direct query without RLS recursion
      const { data: chamaData, error: chamaError } = await supabase
        .from('chamas')
        .select(`
          id,
          name,
          description,
          created_at,
          updated_at,
          created_by,
          status
        `)
        .eq('chama_members.user_id', userId)
        .eq('chama_members.status', 'active')
        .eq('chamas.status', 'active')
        .order('created_at', { ascending: false });

      if (chamaError) {
        console.error('Error fetching chamas:', chamaError);
        
        // If there's still RLS recursion, use a different approach
        if (chamaError.code === '42P17') {
          return await this.getUserChamasFallback(userId);
        }
        
        handleDatabaseError(chamaError, 'getUserChamas');
        return { success: false, error: 'Failed to fetch your chamas' };
      }

      if (!chamaData || chamaData.length === 0) {
        console.log('No chamas found for user:', userId);
        return { success: true, data: [] };
      }

      // Get member counts separately to avoid RLS issues
      const chamasWithMemberCount = await Promise.all(
        chamaData.map(async (chama) => {
          const memberCount = await this.getChamaMemberCount(chama.id);
          return {
            ...chama,
            member_count: memberCount,
            total_contributions: 0, // You can calculate this separately
          };
        })
      );

      console.log(`Successfully fetched ${chamasWithMemberCount.length} chamas for user`);
      return { success: true, data: chamasWithMemberCount };

    } catch (error) {
      console.error('Unexpected error in getUserChamas:', error);
      handleDatabaseError(error, 'getUserChamas - unexpected');
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Fallback method for getting user chamas without RLS recursion
   */
  private async getUserChamasFallback(userId: string): Promise<{ success: boolean; data?: Chama[]; error?: string }> {
    try {
      console.log('Using fallback method for fetching chamas');
      
      // Get chama IDs first using a simple query
      const { data: memberData, error: memberError } = await supabase
        .from('chama_members')
        .select('chama_id')
        .eq('user_id', userId)
        .eq('status', 'active');

      if (memberError) {
        console.error('Error in fallback method:', memberError);
        return { success: false, error: 'Failed to fetch your chamas' };
      }

      if (!memberData || memberData.length === 0) {
        return { success: true, data: [] };
      }

      const chamaIds = memberData.map(member => member.chama_id);
      
      // Get chama details using the IDs
      const { data: chamaData, error: chamaError } = await supabase
        .from('chamas')
        .select('*')
        .in('id', chamaIds)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (chamaError) {
        console.error('Error fetching chama details in fallback:', chamaError);
        return { success: false, error: 'Failed to fetch chama details' };
      }

      const chamasWithMemberCount = await Promise.all(
        (chamaData || []).map(async (chama) => {
          const memberCount = await this.getChamaMemberCount(chama.id);
          return {
            ...chama,
            member_count: memberCount,
            total_contributions: 0,
          };
        })
      );

      return { success: true, data: chamasWithMemberCount };

    } catch (error) {
      console.error('Error in fallback method:', error);
      return { success: false, error: 'Failed to fetch your chamas' };
    }
  }

  /**
   * Get member count for a chama
   */
  private async getChamaMemberCount(chamaId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('chama_members')
        .select('id', { count: 'exact' })
        .eq('chama_id', chamaId)
        .eq('status', 'active');

      if (error) {
        console.error('Error getting member count:', error);
        return 0;
      }

      return data?.length || 0;
    } catch (error) {
      console.error('Error in getChamaMemberCount:', error);
      return 0;
    }
  }

  /**
   * Get chama details by ID - FIXED VERSION
   */
  async getChamaById(chamaId: string, userId: string): Promise<{ success: boolean; data?: Chama; error?: string }> {
    try {
      if (!chamaId || !userId) {
        return { success: false, error: 'Chama ID and User ID are required' };
      }

      // Use a simple query to check access
      const { data: memberData, error: memberError } = await supabase
        .from('chama_members')
        .select('id')
        .eq('chama_id', chamaId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (memberError || !memberData) {
        return { success: false, error: 'Chama not found or access denied' };
      }

      const { data: chamaData, error: chamaError } = await supabase
        .from('chamas')
        .select('*')
        .eq('id', chamaId)
        .single();

      if (chamaError) {
        handleDatabaseError(chamaError, 'getChamaById');
        return { success: false, error: 'Failed to fetch chama details' };
      }

      if (!chamaData) {
        return { success: false, error: 'Chama not found' };
      }

      const memberCount = await this.getChamaMemberCount(chamaId);
      const chama: Chama = {
        ...chamaData,
        member_count: memberCount,
        total_contributions: 0,
      };

      return { success: true, data: chama };

    } catch (error) {
      handleDatabaseError(error, 'getChamaById');
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  // ... rest of your methods remain the same
}

export const chamaService = new ChamaService();