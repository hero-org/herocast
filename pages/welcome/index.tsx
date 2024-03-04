import React, {  } from "react";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/router";
import BigOptionSelector from "@/common/components/BigOptionSelector";

export default function Welcome() {
  const router = useRouter();

  return (
    <div className="w-full">
      <div className="space-y-6 p-10 pb-16 block">
        <div className="space-y-1 max-w-lg">
          <h2 className="text-2xl font-bold tracking-tight">Welcome to herocast</h2>
          <p className="text-muted-foreground">herocast is a client for Farcaster with focus on keyboard-first desktop experience for power users and teams</p>
        </div>
        <Separator className="my-6" />
        <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
          <BigOptionSelector
            options={[
              {
                title: "I have a Farcaster account",
                description: "I signed up for Farcaster before and want to connect my account to herocast.",
                buttonText: "Connect my account",
                onClick: () => router.push("/accounts"),
              },
              {
                title: "I am new to Farcaster",
                description: "I am new to Farcaster and want to create a new account",
                buttonText: "Create new account",
                onClick: () => router.push("/farcaster-signup"),
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
