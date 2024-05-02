import React, { useEffect } from "react";
// import { useRouter } from "next/router";
// import { useIsMounted } from "@/common/helpers/hooks";
// import { createClient } from "@/common/helpers/supabase/component";

const Index = () => {
  // const isMounted = useIsMounted();
  // const router = useRouter();
  // const supabaseClient = createClient();

  // useEffect(() => {
  //   console.log("Index useEffect", isMounted(), router.pathname);
  //   if (!isMounted()) return;

  //   supabaseClient.auth.getSession().then(({ data: { session } }) => {
  //     if (session) {
  //       router.push("/feed");
  //     } else {
  //       router.push("/login");
  //     }
  //   });
  // }, [isMounted(), router]);

  return (
    <p className="m-4 text-gray-800 dark:text-gray-200 text-md">
      Redirecting...
    </p>
  );
};

export default Index;
