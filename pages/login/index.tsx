import "@farcaster/auth-kit/styles.css";
import React from "react";
import { UserAuthForm } from "@/common/components/UserAuthForm";
import { AuthKitProvider } from "@farcaster/auth-kit";
import { openWindow } from "@/common/helpers/navigation";
import clsx from "clsx";
import { useRouter } from "next/router";
import FarcasterIcon from "@/common/components/icons/FarcasterIcon";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const authKitConfig = {
  rpcUrl: `https://opt-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
  domain: "app.herocast.xyz",
  // siweUri: `${process.env.NEXT_PUBLIC_URL}/api/auth/siwe`,
};

export default function Login() {
  const router = useRouter();
  const signupOnly = router?.query?.signupOnly === "true";
  const renderAuthForm = () => (
    <div className="text-lg text-foreground sm:mx-auto sm:w-full sm:max-w-sm">
      <UserAuthForm signupOnly={signupOnly} />
    </div>
  );

  return (
    <div className="mt-18 flex items-center justify-center py-12">
      <AuthKitProvider config={authKitConfig}>
        <Card className="mx-auto max-w-sm">
          <CardHeader>
            <CardTitle className="text-2xl">Welcome to herocast</CardTitle>
            <CardDescription>
              Enter your email below to login to your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {renderAuthForm()}
          </CardContent>
        </Card>
      </AuthKitProvider>
    </div>
  );
}
