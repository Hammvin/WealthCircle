import { ChamaService } from '@/lib/chama';
import { useEffect, useState } from 'react';

export const useChama = (chamaId: string) => {
  const [chama, setChama] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!chamaId) return;

    const loadChama = async () => {
      setLoading(true);
      setError(null);
      
      const result = await ChamaService.getChamaDetails(chamaId);
      
      if (result.success) {
        setChama(result.chama);
      } else {
        setError(result.error);
      }
      
      setLoading(false);
    };

    loadChama();
  }, [chamaId]);

  const refresh = async () => {
    if (!chamaId) return;
    
    setLoading(true);
    const result = await ChamaService.getChamaDetails(chamaId);
    
    if (result.success) {
      setChama(result.chama);
    }
    
    setLoading(false);
  };

  return { chama, loading, error, refresh };
};