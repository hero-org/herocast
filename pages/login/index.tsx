import "@farcaster/auth-kit/styles.css";
import React, { useEffect, useState } from "react";
import { createClient } from "../../src/common/helpers/supabase/component";
import { hydrate, useAccountStore } from "../../src/stores/useAccountStore";
import { useRouter } from "next/router";
import { UserAuthForm } from "@/common/components/UserAuthForm";
import { AuthKitProvider, useProfile } from "@farcaster/auth-kit";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import {
  AccountPlatformType,
  AccountStatusType,
} from "../../src/common/constants/accounts";

const APP_FID = Number(process.env.NEXT_PUBLIC_APP_FID!);

const authKitConfig = {
  rpcUrl: `https://opt-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
  domain: process.env.NEXT_PUBLIC_URL,
  siweUri: "https://example.com/login",
};

export default function Login() {
  const router = useRouter();
  const supabase = createClient();

  const { addAccount } = useAccountStore();

  const { isAuthenticated, profile } = useProfile();

  useEffect(() => {
    const setupLocalAccount = async () => {
      const { fid } = profile;
      if (!fid) return;
      const neynarClient = new NeynarAPIClient(
        process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
      );

      const users = (
        await neynarClient.fetchBulkUsers([fid], { viewerFid: APP_FID })
      ).users;
      if (!users.length) {
        console.error("No users found for fid: ", fid);
        return;
      }

      addAccount({
        account: {
          name: profile.username,
          status: AccountStatusType.active,
          platform: AccountPlatformType.farcaster_local_readonly,
          platformAccountId: fid.toString(),
          user: users[0],
        },
        localOnly: true,
      });
      router.push("/feed");
    };
    if (isAuthenticated && profile) {
      setupLocalAccount();
    }
  }, [isAuthenticated, profile]);

  console.log("Farcaster Auth: ", isAuthenticated, profile);

  const renderAuthForm = () => (
    <div className="mt-10 text-lg text-foreground sm:mx-auto sm:w-full sm:max-w-sm">
      <UserAuthForm />
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
                <h1 className="bg-gradient-to-tl from-white via-stone-200 to-stone-400 bg-clip-text text-center text-4xl font-bold leading-tight tracking-tight text-transparent drop-shadow-sm dark:from-stone-100 dark:to-yellow-200 md:text-7xl md:leading-[6rem] lg:leading-[1.1]">
                  <p className="inline-block">
                    <span>The Fastest Farcaster Experience </span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="42"
                      height="42"
                      viewBox="0 0 1024 1024"
                      fill="#8A63D2"
                      className="ml-2 bg-gray-100 rounded-lg inline-block items-center"
                    >
                      <rect width="1024" height="1024" fill="none" />
                      <path d="M308.786 227H715.928V308.429L817.714 308.429L797.357 389.857H777V715.571C788.247 715.571 797.357 724.681 797.357 735.928V756.286C808.604 756.286 817.714 765.396 817.714 776.643V797H614.143V776.643C614.143 765.396 623.253 756.286 634.5 756.286L634.5 735.928C634.5 724.681 643.61 715.571 654.857 715.571L654.857 550.97C654.795 472.322 591.019 408.586 512.357 408.586C433.672 408.586 369.883 472.359 369.857 551.038L369.857 715.571C381.104 715.571 390.214 724.681 390.214 735.928V756.286C401.462 756.286 410.571 765.396 410.571 776.643V797H207V776.643C207 765.396 216.11 756.286 227.357 756.286L227.357 735.928C227.357 724.681 236.467 715.571 247.714 715.571L247.714 389.857H227.357L207 308.429L308.786 308.429V227Z" />
                    </svg>
                  </p>
                </h1>
                <p className="mt-6 text-lg font-light leading-0 text-gray-200">
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
                <p className="px-8 text-center text-md text-gray-400">
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
