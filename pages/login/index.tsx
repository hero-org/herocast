import "@farcaster/auth-kit/styles.css";
import React from "react";
import { UserAuthForm } from "@/common/components/UserAuthForm";
import { AuthKitProvider } from "@farcaster/auth-kit";
import { useRouter } from "next/router";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const authKitConfig = {
  rpcUrl: `https://opt-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
  domain: "app.herocast.xyz",
  // siweUri: `${process.env.NEXT_PUBLIC_URL}/api/auth/siwe`,
};

export default function Login() {
  const router = useRouter();
  const { signupOnly, view } = router.query;

  const showOnlySignup = signupOnly === "true" || view === "reset";
  const renderAuthForm = () => (
    <div className="text-lg text-foreground sm:mx-auto sm:w-full sm:max-w-sm">
      <UserAuthForm signupOnly={showOnlySignup} />
    </div>
  );

  return (
    <div className="w-full min-h-screen lg:grid lg:grid-cols-2 xl:min-h-[800px]">
      <div className="mt-18 flex items-center justify-center py-12">
        <AuthKitProvider config={authKitConfig}>
          <Card className="mx-auto min-w-80 max-w-80">
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl">Welcome to herocast</CardTitle>
            </CardHeader>
            <CardContent>{renderAuthForm()}</CardContent>
          </Card>
        </AuthKitProvider>
      </div>
      <div className="hidden bg-muted lg:block">
        <img
          src="/images/herocast-app-screenshot.png"
          alt="herocast-app-screenshot"
          width="1920"
          height="1080"
          style={{ objectPosition: "left" }}
          className="h-full w-full object-cover dark:brightness-[0.8]"
        />
      </div>
    </div>
  );
}
