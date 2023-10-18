import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabaseClient } from '../src/common/helpers/supabase';

const Index = () => {
    const router = useRouter()

    useEffect(() => {
        supabaseClient.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
                router.push('/login');
            } else {
                router.push('/feed');
            }
        })
    }, []);

    return (
        <p className="m-4 text-gray-200 text-md">Redirecting...</p>
    );
};

export default Index;
