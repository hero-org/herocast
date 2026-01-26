'use client';

import type { User } from '@supabase/supabase-js';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createClient } from '../helpers/supabase/component';

interface AuthContextType {
  user: User | null;
  didLoad: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [didLoad, setDidLoad] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const supabaseClientRef = useRef<ReturnType<typeof createClient> | null>(null);

  // Lazily initialize Supabase client only on client-side
  const getSupabaseClient = () => {
    if (!supabaseClientRef.current) {
      supabaseClientRef.current = createClient();
    }
    return supabaseClientRef.current;
  };

  useEffect(() => {
    const supabaseClient = getSupabaseClient();
    supabaseClient.auth.getUser().then((res) => {
      setUser(res.data.user || null);
      setDidLoad(true);
    });

    const { data: authListener } = supabaseClient.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!didLoad) return;

    const isLoggedOut = !user;
    const shouldForward =
      pathname !== '/login' &&
      !pathname.startsWith('/profile') &&
      !pathname.startsWith('/conversation') &&
      !pathname.startsWith('/analytics');

    if (isLoggedOut && shouldForward) {
      router.push('/login');
    }
  }, [user, pathname, didLoad]);

  return <AuthContext.Provider value={{ user, didLoad }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
