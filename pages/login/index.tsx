import React, { useEffect, useState } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabaseClient } from "../../src/common/helpers/supabase";
import { hydrate } from "../../src/stores/useAccountStore";
import get from "lodash.get";
import { useRouter } from "next/router";

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

  return (
    <>
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <div className="mx-auto">
          <h1 className="text-center text-4xl font-bold tracking-tight text-white sm:text-6xl">
            Welcome to herocast
          </h1>
          <p className="mt-6 text-center text-lg leading-8 text-gray-300">
            Sign up or login to get started
          </p>
          {isLoading && (
            <span className="my-4 font-semibold text-gray-200">Loading...</span>
          )}
          <div className="mt-10 text-lg text-white sm:mx-auto sm:w-full sm:max-w-sm">
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
