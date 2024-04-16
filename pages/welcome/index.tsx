import React, {  } from "react";
import { Separator } from "@/components/ui/separator";
import WelcomeCards from "@/common/components/WelcomeCards";

export default function Welcome() {
  return (
    <div className="w-full">
      <div className="space-y-6 p-10 pb-16 block">
        <div className="space-y-1 max-w-lg">
          <h2 className="text-2xl font-bold tracking-tight">Welcome to herocast</h2>
          <p className="text-muted-foreground">herocast is a client for Farcaster with focus on keyboard-first desktop experience for power users and teams</p>
        </div>
        <Separator className="my-6" />
        <WelcomeCards />
      </div>
    </div>
  );
}
