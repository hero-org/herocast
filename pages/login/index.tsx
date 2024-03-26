import "@farcaster/auth-kit/styles.css";
import React, { useEffect, useState } from "react";
import { createClient } from "../../src/common/helpers/supabase/component";
import { hydrate } from "../../src/stores/useAccountStore";
import get from "lodash.get";
import { useRouter } from "next/router";
import { usePostHog } from "posthog-js/react";
import { UserAuthForm } from "@/common/components/UserAuthForm";
import { AuthKitProvider, useProfile } from "@farcaster/auth-kit";

const authKitConfig = {
  rpcUrl: `https://opt-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
  domain: process.env.NEXT_PUBLIC_URL,
  siweUri: 'https://example.com/login',
};

export default function Login() {
  const router = useRouter();
  const supabase = createClient()
  const posthog = usePostHog();

  const [isLoading, setIsLoading] = useState(false);
  const { asPath } = router;
  const hash = asPath.split("#")[1] || "";
  const queryParams = hash
    .substring(1)
    .split("&")
    .reduce((acc, curr) => {
      const [key, value] = curr.split("=");
      return { ...acc, [key]: value };
    }, {});

  const {
    isAuthenticated,
    profile,
  } = useProfile();

  useEffect(() => {
    if (isAuthenticated && profile) {
      // useAccountStore, setup new account, but only locally
    }
  }, [isAuthenticated, profile])

  console.log('Farcaster Auth: ', isAuthenticated, profile);

  const requestType = get(queryParams, "type");
  console.log("Login queryParams.type", requestType);

  const setupUser = async (session) => {
    setIsLoading(true);
    if (session?.user?.id) {
      posthog.identify(session?.user?.id);
    }
    await hydrate();
    setIsLoading(false);
    router.push("/feed");
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log(`Login getSession`, session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`Login onAuthStateChange`, event);

      if (event === "INITIAL_SESSION") {
        console.log("initial session");
      } else if (event === "PASSWORD_RECOVERY") {
        console.log("new pw being set");
      } else if (event === "USER_UPDATED") {
        console.log("Login onAuthStateChange hasSession");
      } else if (event === "SIGNED_IN") {
        console.log("Login onAuthStateChange signed in - hydrate and navigate");
        setupUser(session);
      } else if (event === "SIGNED_OUT") {
        console.log("Login onAuthStateChange signed out");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const renderAuthForm = () => (
    <div className="mt-10 text-lg text-foreground sm:mx-auto sm:w-full sm:max-w-sm">
      <UserAuthForm />
      {/* <Auth
        supabaseClient={supabaseClient}
        providers={[]}
        appearance={appearance}
        queryParams={queryParams}
        magicLink
        dark
      /> */}
    </div>
  );

  return (
    <AuthKitProvider config={authKitConfig}>
      <div className="w-full max-w-full min-h-screen">
        <div className="container relative h-screen flex-col items-center grid lg:max-w-none lg:grid-cols-2 lg:px-0">
          <div className="relative h-full flex-col bg-muted p-10 text-foreground flex dark:border-r">
            <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-l from-gray-900 via-gray-700 to-stone-500" />
            <div className="relative z-20 flex items-center text-lg font-medium text-gray-200">
              {/* <img
              className="h-8 w-auto mr-1"
              src={herocastImg.src}
              alt="herocast"
            /> */}
            </div>
            <div className="relative z-20 mt-auto">
              <div className="text-center">
                <h1 className="bg-gradient-to-br from-gray-100 to-stone-300 bg-clip-text text-center text-4xl font-bold leading-tight tracking-tight text-transparent drop-shadow-sm dark:from-stone-100 dark:to-yellow-200 md:text-7xl md:leading-[6rem] lg:leading-[1.1]">
                  The Fastest Farcaster Experience
                </h1>
                <p className="mt-6 text-lg leading-8 text-gray-200">
                  Be superhuman onchain.
                  <br />
                  Share Farcaster accounts with onchain permissions.
                  <br />
                  Switch between multiple accounts.
                  <br />
                  Use keyboard shortcuts to navigate everything.
                </p>
                {/* <div className="mt-10 flex items-center justify-center gap-x-6">
                <Button
                  variant="default"
                  size="lg"
                  className="p-6"
                  type="button"
                >
                  Join Hyperion
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="p-6"
                  type="button"
                >
                  Learn more <span aria-hidden="true">→</span>
                </Button>
              </div> */}
              </div>
            </div>
          </div>
          <div className="bg-gray-900 h-full w-full p-8 lg:pt-24">
            <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
              <div className="flex flex-col space-y-2 text-center">
                <h1 className="text-3xl font-semibold tracking-tight text-gray-100">
                  Welcome to herocast
                </h1>
                <p className="px-8 text-center text-md text-gray-300">
                  Your herocast account can be used to connect multiple
                  Farcaster accounts.
                </p>
              </div>
              {renderAuthForm()}
            </div>
          </div>
        </div>
      </div>
    </AuthKitProvider>
  );
}
