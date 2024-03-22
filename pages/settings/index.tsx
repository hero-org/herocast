import React, { useEffect, useState } from "react";
import AlertDialogDemo from "../../src/common/components/AlertDialog";
import HelpCard from "../../src/common/components/HelpCard";
import { classNames } from "../../src/common/helpers/css";
import { supabaseClient } from "../../src/common/helpers/supabase";
import { Button } from "../../src/components/ui/button";
import {
  AccountObjectType,
  PENDING_ACCOUNT_NAME_PLACEHOLDER,
  accountCommands,
  channelCommands,
  hydrate,
  useAccountStore,
} from "../../src/stores/useAccountStore";
import { newPostCommands } from "../../src/stores/useNewPostStore";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/router";
import { getNavigationCommands } from "../../src/getNavigationCommands";
import AccountSettingsModal from "../../src/common/components/AccountSettingsModal";
import { useAccount, useSwitchAccount } from "wagmi";
import { useAccountModal, useConnectModal } from "@rainbow-me/rainbowkit";
import { AccountPlatformType, AccountStatusType } from "../../src/common/constants/accounts";
import { Loading } from "../../src/common/components/Loading";
import { ArrowPathIcon } from "@heroicons/react/20/solid";
import { getUsernameForFid } from "../../src/common/helpers/farcaster";
import SwitchWalletButton from "@/common/components/SwitchWalletButton";

type SimpleCommand = {
  name: string;
  shortcut: string;
};

export default function Settings() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] =
    useState<AccountObjectType | null>(null);
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();

  const {
    hydratedAt,
    addAccount,
    setAccountActive,
    accounts,
    resetStore,
    removeAccount,
    updateAccountUsername,
  } = useAccountStore();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  const onLogout = async () => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();

    if (session) {
      resetStore();
      setUser(null);
      await supabaseClient.auth.signOut();
    }

    router.push("/login");
  };

  const displayEmail = user?.email
    ? `${user?.email.slice(0, 5)}...@${user?.email.split("@")[1]}`
    : "";

  const onClickManageAccount = (account: AccountObjectType) => {
    setSelectedAccount(account);
    setOpen(true);
  };

  const syncAccountNameFromProtocolToDB = async (
    account: AccountObjectType
  ) => {
    try {
      const fid = account.platformAccountId;
      if (fid && account.status === "active") {
        const username = await getUsernameForFid(Number(fid));
        console.log("protocol", username, "DB", account.name);
        if (username && username !== account.name) {
          await updateAccountUsername(account.id, username);
        }
      }
    } catch (error) {
      console.error("Failed to sync account name from protocol to DB", error);
    }
  };

  const refreshAccountNames = async () => {
    Promise.all(accounts.map(syncAccountNameFromProtocolToDB))
      .then(() => {
        console.log("All account names refreshed successfully");
        hydrate();
      })
      .catch((error) =>
        console.error("Error refreshing account names:", error)
      );
  };

  const renderInfoSection = () => {
    const allCommands = [
      { name: "Command Palette", shortcut: "cmd+k" },
      { name: "Feed: go to previous cast in list", shortcut: "k" },
      { name: "Feed: go to next cast in list", shortcut: "j" },
      { name: "Feed: Open thread view for cast", shortcut: "Enter or o" },
      { name: "Feed: Open embedded link in new tab", shortcut: "shift+o" },
      ...getNavigationCommands({ router }),
      ...newPostCommands,
      ...accountCommands,
      ...channelCommands,
    ];

    const commandsWithShortcuts: SimpleCommand[] = allCommands.filter(
      (command) => command.shortcut !== undefined
    );

    return (
      <div className="w-2/3 mt-20 overflow-hidden">
        <div className="border-b border-border">
          <h1 className="text-xl font-semibold leading-7 text-foreground/80">
            Hotkeys / Keyboard Shortcuts
          </h1>
        </div>
        <div className="border-t border-muted">
          <dl className="divide-y divide-muted">
            {commandsWithShortcuts.map((command) => (
              <div
                key={`command-${command.name}`}
                className="px-2 py-4 sm:grid sm:grid-cols-3 sm:gap-4"
              >
                <dt className="text-sm text-foreground/60">{command.name}</dt>
                {command.shortcut && (
                  <dd className="mt-1 text-sm leading-6 font-semibold text-foreground sm:col-span-1 sm:mt-0">
                    {command.shortcut.replace(/\+/g, " + ")}
                  </dd>
                )}
              </div>
            ))}
          </dl>
        </div>
      </div>
    );
  };

  return (
    <div className="ml-10 mt-10 flex flex-col space-y-4">
      <div className="border-b border-gray-200">
        <h1 className="text-xl font-semibold leading-7 text-foreground/80">
          Herocast account
        </h1>
      </div>
      <div className="flex flex-row mt-4 px-2">
        <span className="text-sm font-semibold text-foreground/80 mr-2">
          Email
        </span>
        <span className="text-sm font-semibold text-foreground/70 ">
          {displayEmail}
        </span>
      </div>
      <div className="flex flex-row gap-4">
        <SwitchWalletButton />
        <Button
          type="button"
          variant="destructive"
          onClick={() => onLogout()}
          className="w-20"
        >
          Logout
        </Button>
      </div>
      <div className="flex justify-between pb-2 border-b border-gray-200">
        <h1 className="text-xl font-semibold leading-7 text-foreground/80">
          Farcaster accounts
        </h1>
        <Button
          variant="outline"
          className="h-8"
          onClick={() => refreshAccountNames()}
        >
          Reload accounts
          <ArrowPathIcon className="ml-1 w-4 h-4" />
        </Button>
      </div>
      {!hydratedAt && <Loading />}
      <ul role="list" className="divide-y divide-white/5">
        {accounts.map((item: AccountObjectType, idx: number) => (
          <li key={item.id} className="px-2 py-2">
            <div className="flex items-center gap-x-3">
              <h3
                className={classNames(
                  "text-foreground/80",
                  "flex-auto truncate text-sm font-semibold leading-6"
                )}
              >
                {item.name || PENDING_ACCOUNT_NAME_PLACEHOLDER}
              </h3>
              {item.platformAccountId && item.status !== "active" && (
                <p className="truncate text-sm text-foreground/80">
                  {item.status}
                </p>
              )}
              {item.platform ===
                AccountPlatformType.farcaster_hats_protocol && (
                <p className="text-sm">🧢</p>
              )}
              {item.platformAccountId && item.status === "active" && (
                <p className="font-mono truncate text-sm text-foreground/80">
                  fid: {item.platformAccountId}
                </p>
              )}
              <Button
                variant="secondary"
                onClick={() => onClickManageAccount(item)}
              >
                Manage
              </Button>
              <AlertDialogDemo
                buttonText={`Remove`}
                onClick={() => removeAccount(idx)}
              />
            </div>
          </li>
        ))}
      </ul>
      <HelpCard />
      {renderInfoSection()}
      <AccountSettingsModal
        account={selectedAccount}
        open={open}
        setOpen={setOpen}
      />
    </div>
  );
}
