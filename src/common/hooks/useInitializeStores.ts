import { initializeStores, initializeStoresProgressive } from '@/stores/initializeStores';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigationStore } from '@/stores/useNavigationStore';

enum InitStatus {
  uninitialized = 'uninitialized',
  pending = 'pending',
  initialized = 'initialized',
}

const useInitializeStores = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<InitStatus>(InitStatus.uninitialized);
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const initialize = async () => {
      const shouldInitialize = status === InitStatus.uninitialized || user?.id !== prevUserIdRef.current;
      if (user && shouldInitialize) {
        try {
          setStatus(InitStatus.pending);
          prevUserIdRef.current = user.id;

          // Initialize sidebar state from localStorage
          useNavigationStore.getState().initializeSidebarState();

          // Use progressive hydration for better performance
          await initializeStoresProgressive();
          setStatus(InitStatus.initialized);
        } catch (error) {
          console.error('Failed to initialize stores:', error);
          setStatus(InitStatus.uninitialized);
        }
      }
    };

    initialize();
  }, [user, status]);
};

export default useInitializeStores;
