import React, { useEffect, useState } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabaseClient } from "../../src/common/helpers/supabase";
import { hydrate } from "../../src/stores/useAccountStore";
import get from "lodash.get";
import { useRouter } from "next/router";
import Image from "next/image"
import Link from "next/link"
import { classNames } from "../../src/common/helpers/css";
import { buttonVariants } from "@/components/ui/button";

const appearance = {
  extend: true,
  theme: ThemeSupa,
  variables: {
    default: {
      colors: {
        brand: "rgb(16 185 129)",
        brandAccent: "rgb(5 150 105)",
        inputBorder: "#F3F4F6",
        inputBorderHover: "rgb(229 231 235)",
        inputBorderFocus: "rgb(229 231 235)",
        inputText: "#F3F4F6",
        inputLabelText: "#F3F4F6",
        inputPlaceholder: "#F3F4F6",
        messageText: "#c2410c",
        messageTextDanger: "#b45309",
        anchorTextColor: "#6b7280",
        anchorTextHoverColor: "#d1d5db",
      },
      radii: {
        borderRadiusButton: "2px",
        buttonBorderRadius: "2px",
        inputBorderRadius: "2px",
      },
    },
  },
};

export default function Login() {
  const router = useRouter();
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

  const requestType = get(queryParams, "type");
  console.log("Login queryParams.type", requestType);

  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      console.log(`Login getSession`, session);
    });

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((event, session) => {
      console.log(`Login onAuthStateChange`, event);

      if (event === "INITIAL_SESSION") {
        console.log("initial session");
      } else if (event === "PASSWORD_RECOVERY") {
        console.log("new pw being set");
      } else if (event === "USER_UPDATED") {
        console.log("Login onAuthStateChange hasSession");
      } else if (event === "SIGNED_IN") {
        console.log("Login onAuthStateChange signed in - hydrate and navigate");
        setIsLoading(true);
        hydrate();
        setIsLoading(false);
        router.push("/feed");
      } else if (event === "SIGNED_OUT") {
        console.log("Login onAuthStateChange signed out");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const renderAuthForm = () => (
    <div className="mt-10 text-lg text-foreground sm:mx-auto sm:w-full sm:max-w-sm">
    <Auth
      supabaseClient={supabaseClient}
      providers={[]}
      appearance={appearance}
      queryParams={queryParams}
      magicLink
      dark
    />
  </div>
);

  return (
    <div className="w-full max-w-full min-h-screen">
      <div className="md:hidden">
        <Image
          src="/examples/authentication-light.png"
          width={1280}
          height={843}
          alt="Authentication"
          className="block dark:hidden"
        />
        <Image
          src="/examples/authentication-dark.png"
          width={1280}
          height={843}
          alt="Authentication"
          className="hidden dark:block"
        />
      </div>
      <div className="container relative h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0">
        <div className="relative h-full flex-col bg-muted p-10 text-foreground flex dark:border-r">
          <div className="absolute inset-0 bg-background" />
          <div className="relative z-20 flex items-center text-lg font-medium">
            herocast
          </div>
          <div className="relative z-20 mt-auto">
            <blockquote className="space-y-2">
              <p className="text-lg">
                herocast is an open-source Farcaster client for small teams and DAOs
              </p>
              <footer className="text-sm">@hellno.eth</footer>
            </blockquote>
          </div>
        </div>
        <div className="lg:p-8">
          <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
            <div className="flex flex-col space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Welcome to herocast
              </h1>
              <p className="px-8 text-center text-sm text-muted-foreground">
                Your herocast account can be used to connect multiple Farcaster accounts.
              </p>
            </div>
            {renderAuthForm()}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <div className="mx-auto">
          <h1 className="text-center text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            Welcome to herocast
          </h1>
          <p className="mt-6 text-center text-lg leading-8 text-foreground/80">
            Sign up or login to get started
          </p>
          {isLoading && (
            <span className="my-4 font-semibold text-gray-200">Loading...</span>
          )}
          <div className="mt-10 text-lg text-foreground sm:mx-auto sm:w-full sm:max-w-sm">
            <Auth
              supabaseClient={supabaseClient}
              providers={[]}
              appearance={appearance}
              queryParams={queryParams}
              dark
            />
          </div>
        </div>
      </div>
    </>
  );
}
