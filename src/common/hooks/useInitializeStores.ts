import { initializeStores } from '@/stores/initializeStores';
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const useInitializeStores = () => {
    const { user } = useAuth();

    useEffect(() => {
        const initialize = async () => {
            if (user) {
                try {
                    await initializeStores();
                } catch (error) {
                    console.error('Failed to initialize stores:', error);
                }
            }
        };

        initialize();
    }, [user]);
};

export default useInitializeStores; 