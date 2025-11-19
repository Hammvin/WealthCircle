import { supabase } from '@/utils/supabase';
import { useEffect, useState } from 'react';

export const useRealtimeChama = (chamaId: string) => {
  const [contributions, setContributions] = useState([]);
  const [payouts, setPayouts] = useState([]);

  useEffect(() => {
    if (!chamaId) return;

    // Subscribe to contributions changes
    const contributionSubscription = supabase
      .channel(`chama:${chamaId}:contributions`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contributions',
          filter: `chama_id=eq.${chamaId}`,
        },
        (payload) => {
          console.log('Contribution change received:', payload);
          // In a real app, you'd update the local state appropriately
          // For now, we'll just log the changes
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to contributions channel');
        }
      });

    // Subscribe to payout changes
    const payoutSubscription = supabase
      .channel(`chama:${chamaId}:payouts`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payout_requests',
          filter: `chama_id=eq.${chamaId}`,
        },
        (payload) => {
          console.log('Payout change received:', payload);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to payouts channel');
        }
      });

    return () => {
      contributionSubscription.unsubscribe();
      payoutSubscription.unsubscribe();
    };
  }, [chamaId]);

  return { contributions, payouts };
};