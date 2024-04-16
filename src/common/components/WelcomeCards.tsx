import React from "react";
import BigOptionSelector from "@/common/components/BigOptionSelector";
import { CUSTOM_CHANNELS, useAccountStore } from "@/stores/useAccountStore";
import { useRouter } from "next/router";
import { AccountPlatformType, AccountStatusType } from "../constants/accounts";
const WelcomeCards = () => {
  const router = useRouter();

  const { accounts, setSelectedChannelUrl } = useAccountStore();

  const hasPendingAccount = accounts.some(
    (account) => account.status === AccountStatusType.pending
  );
  const isReadOnly = accounts.every(
    (account) =>
      account.platform === AccountPlatformType.farcaster_local_readonly
  );
  return (
    <div className="m-8 flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
      <BigOptionSelector
        options={[
          hasPendingAccount
            ? undefined
            : {
                title: "Continue to connect to herocast",
                description:
                  "Finish connecting your Farcaster account with your web3 wallet or by scanning a QR code.",
                buttonText: "Continue",
                onClick: () => router.push("/accounts"),
              },
          {
            title: "Got a Farcaster account?",
            description:
              "If you signed up for Farcaster and want to connect it to herocast.",
            buttonText: "Connect my account",
            onClick: () => router.push("/accounts"),
          },
          {
            title: "New to Farcaster?",
            description: "Create a new Farcaster account with herocast.",
            buttonText: "Create new account",
            onClick: () => router.push("/farcaster-signup"),
          },
          isReadOnly
            ? {
                title: "Follow the herocast team on Paragraph",
                description:
                  "Get updates on herocast and Farcaster in the newsletter",
                content: (
                  <iframe
                    src="https://paragraph.xyz/@hellno/embed?minimal=true&vertical=true"
                    width="100%"
                    height="90"
                    style={{ border: "1px solid #EEE", background: "white" }}
                  ></iframe>
                ),
              }
            : undefined,
          {
            title: "Browse trending feed",
            description:
              "No need to signup if you just want to checkout herocast",
            buttonText: "Trending Feed →",
            onClick: () => {
              setSelectedChannelUrl(CUSTOM_CHANNELS.TRENDING);
              router.push("/feed");
            },
          },
        ]}
      />
    </div>
  );
};

export default WelcomeCards;
