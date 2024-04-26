import React, { useEffect } from "react";
import { useRouter } from "next/router";
import { createClient } from "@/common/helpers/supabase/component";

const Index = () => {
  const router = useRouter();
  const supabaseClient = createClient();

  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/login");
      } else {
        router.push("/feed");
      }
    });
  }, []);return (
    <p className="m-4 text-gray-800 dark:text-gray-200 text-md">
      Redirecting...
    </p>
  );
};

export default Index;
