import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Goal, listGoals } from '../api/goals';
import { useAuth } from './AuthContext';

interface GoalsState {
  goals: Goal[];
  isLoading: boolean;
  error: string;
  activeGoalId: string | null;
  setActiveGoalId: (id: string) => void;
  isAddingGoal: boolean;
  startAddGoal: () => void;
  stopAddGoal: () => void;
  refreshGoals: () => Promise<void>;
}

const GoalsContext = createContext<GoalsState | undefined>(undefined);

export function GoalsProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeGoalId, setActiveGoalIdState] = useState<string | null>(null);
  const [isAddingGoal, setIsAddingGoal] = useState(false);

  const refreshGoals = useCallback(async () => {
    if (!token) {
      setGoals([]);
      setActiveGoalIdState(null);
      setError('');
      setIsLoading(false);
      return;
    }
    try {
      const list = await listGoals();
      setGoals(list);
      setError('');
      setActiveGoalIdState((current) =>
        current && list.some((g) => g.id === current) ? current : (list[0]?.id ?? null)
      );
    } catch {
      // Deliberately does not clear `goals` here — a transient failure on a
      // refresh (not the very first load) must not make an already-onboarded
      // user look goal-less and get bounced back into onboarding.
      setError('목표 목록을 불러오지 못했어요');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    setIsLoading(true);
    refreshGoals();
  }, [token, refreshGoals]);

  function setActiveGoalId(id: string) {
    setActiveGoalIdState(id);
  }

  function startAddGoal() {
    setIsAddingGoal(true);
  }

  function stopAddGoal() {
    setIsAddingGoal(false);
  }

  return (
    <GoalsContext.Provider
      value={{
        goals,
        isLoading,
        error,
        activeGoalId,
        setActiveGoalId,
        isAddingGoal,
        startAddGoal,
        stopAddGoal,
        refreshGoals,
      }}
    >
      {children}
    </GoalsContext.Provider>
  );
}

export function useGoals() {
  const ctx = useContext(GoalsContext);
  if (!ctx) throw new Error('useGoals must be used within GoalsProvider');
  return ctx;
}
