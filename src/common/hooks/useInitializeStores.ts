import { initializeStores } from '@/stores/initializeStores';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

const useInitializeStores = () => {
    const { user } = useAuth();
    const [isInitialized, setIsInitialized] = useState(false);
    const prevUserIdRef = useRef<string | null>(null);

    useEffect(() => {
        const initialize = async () => {
            if (user && (!isInitialized || user.id !== prevUserIdRef.current)) {
                try {
                    await initializeStores();
                    setIsInitialized(true);
                    prevUserIdRef.current = user.id;
                } catch (error) {
                    console.error('Failed to initialize stores:', error);
                }
            }
        };

        initialize();
    }, [user, isInitialized]);
};

export default useInitializeStores;
