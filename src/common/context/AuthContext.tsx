import React, { createContext, useContext, useState, useEffect } from "react";
import { createClient } from "../helpers/supabase/component";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/router";

interface AuthContextType {
  user: User | null;
}

const AuthContext = createContext<AuthContextType | null>(null);
const supabaseClient = createClient();

export const AuthProvider = ({ children }) => {
  const router = useRouter();
  const { asPath } = router;

  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabaseClient.auth.getUser().then((res) => setUser(res.data.user || null));

    const { data: authListener } = supabaseClient.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user || null);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const isLoggedOut = !user;
    const shouldForward =
      asPath !== "/login" &&
      !asPath.startsWith("/profile") &&
      !asPath.startsWith("/conversation");

    if (isLoggedOut && shouldForward) {
      router.push("/login");
    }
  }, [user, asPath]);

  return (
    <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
