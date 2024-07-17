import { initializeStores } from '@/stores/initializeStores';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

enum InitializationStatus {
    Uninitialized = 'uninitialized',
    Pending = 'pending',
    Initialized = 'initialized',
}

const useInitializeStores = () => {
    const { user } = useAuth();
    const [status, setStatus] = useState<InitializationStatus>(InitializationStatus.Uninitialized);
    const prevUserIdRef = useRef<string | null>(null);

    useEffect(() => {
        const initialize = async () => {
            if (user && (status === InitializationStatus.Uninitialized || user.id !== prevUserIdRef.current)) {
                try {
                    setStatus(InitializationStatus.Pending);
                    prevUserIdRef.current = user.id;
                    await initializeStores();
                    setStatus(InitializationStatus.Initialized);
                } catch (error) {
                    console.error('Failed to initialize stores:', error);
                    setStatus(InitializationStatus.Uninitialized);
                }
            }
        };

        initialize();
    }, [user, status]);
};

export default useInitializeStores;
