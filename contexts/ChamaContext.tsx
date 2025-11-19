import { ChamaService } from '@/lib/chama';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface Chama {
  id: string;
  name: string;
  description?: string;
  savings_goal: string;
  contribution_cycle: 'weekly' | 'monthly';
  contribution_amount: number;
  total_kitty: number;
  invite_code: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface ChamaContextType {
  currentChama: Chama | null;
  userChamas: Chama[];
  loading: boolean;
  selectChama: (chama: Chama) => void;
  refreshChamas: () => Promise<void>;
}

const ChamaContext = createContext<ChamaContextType | undefined>(undefined);

interface ChamaProviderProps {
  children: ReactNode;
}

export function ChamaProvider({ children }: ChamaProviderProps) {
  const [currentChama, setCurrentChama] = useState<Chama | null>(null);
  const [userChamas, setUserChamas] = useState<Chama[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserChamas();
  }, []);

  const loadUserChamas = async () => {
    try {
      setLoading(true);
      const result = await ChamaService.getUserChamas();
      
      if (result.success) {
        setUserChamas(result.chamas || []);
        if (result.chamas && result.chamas.length > 0 && !currentChama) {
          setCurrentChama(result.chamas[0]);
        }
      }
    } catch (error) {
      console.error('Error loading chamas:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectChama = (chama: Chama) => {
    setCurrentChama(chama);
  };

  const value: ChamaContextType = {
    currentChama,
    userChamas,
    loading,
    selectChama,
    refreshChamas: loadUserChamas,
  };

  return (
    <ChamaContext.Provider value={value}>
      {children}
    </ChamaContext.Provider>
  );
}

export const useChama = (): ChamaContextType => {
  const context = useContext(ChamaContext);
  if (context === undefined) {
    throw new Error('useChama must be used within a ChamaProvider');
  }
  return context;
};