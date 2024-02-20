import React, { useEffect, useState } from "react";
import AlertDialogDemo from "../../src/common/components/AlertDialog";
import HelpCard from "../../src/common/components/HelpCard";
import { classNames } from "../../src/common/helpers/css";
import { supabaseClient } from "../../src/common/helpers/supabase";
import { Button } from "../../src/components/ui/button"
import { AccountObjectType, accountCommands, channelCommands, useAccountStore } from "../../src/stores/useAccountStore";
import { newPostCommands } from "../../src/stores/useNewPostStore";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/router";
import { getNavigationCommands } from '../../src/getNavigationCommands';
import AccountSettingsModal from "../../src/common/components/AccountSettingsModal";
import { useAccount } from "wagmi";
import { useAccountModal, useConnectModal } from "@rainbow-me/rainbowkit";

type SimpleCommand = {
  name: string;
  shortcut: string;
}

export default function Settings() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<AccountObjectType | null>(null);
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();

  const {
    accounts,
    resetStore,
    removeAccount
  } = useAccountStore();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabaseClient.auth.getUser();
      setUser(user);
    }
    getUser();
  }, [])

  const onLogout = async () => {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession()

    if (session) {
      resetStore();
      setUser(null);
      await supabaseClient.auth.signOut();
    }

    router.push('/login');
  }

  const displayEmail = user?.email ? `${user?.email.slice(0, 5)}...@${user?.email.split('@')[1]}` : '';

  const onClickManageAccount = (account: AccountObjectType) => {
    setSelectedAccount(account);
    setOpen(true);
  }

  const renderInfoSection = () => {
    const allCommands= [
      { name: 'Command Palette', shortcut: 'cmd+k' },
      { name: 'Feed: go to previous cast in list', shortcut: 'k' },
      { name: 'Feed: go to next cast in list', shortcut: 'j' },
      { name: 'Feed: Open thread view for cast', shortcut: 'Enter or o' },
      { name: 'Feed: Open embedded link in new tab', shortcut: 'shift+o' },
      ...getNavigationCommands({ router }),
      ...newPostCommands,
      ...accountCommands,
      ...channelCommands,
    ];

    const commandsWithShortcuts: SimpleCommand[] = allCommands.filter((command) => command.shortcut!==undefined);

    return (<div className="mt-20 overflow-hidden">
      <div className="border-b border-border">
        <h1 className="text-xl font-semibold leading-7 text-foreground/80">Hotkeys / Keyboard Shortcuts</h1>
      </div>
      <div className="px-2 py-4">
        <h3 className="text-base font-semibold leading-7 text-foreground/80">hotkeys overview</h3>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-foreground/70">list of all hotkeys in herocast</p>
      </div>
      <div className="border-t border-gray-600">
        <dl className="divide-y divide-gray-600">
          {commandsWithShortcuts.map((command) => (
            <div key={`command-${command.name}`} className="px-2 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm text-foreground/60">{command.name}</dt>
              {command.shortcut && <dd className="mt-1 text-sm leading-6 font-semibold text-foreground sm:col-span-1 sm:mt-0">{command.shortcut.replace(/\+/g, ' + ')}</dd>}
            </div>
          ))}
        </dl>
      </div>
    </div>);
  }


  return (
    <div className="ml-10 mt-10 flex flex-col space-y-4">
      <div className="border-b border-gray-200">
        <h1 className="text-xl font-semibold leading-7 text-foreground/80">Herocast account</h1>
      </div>
      <div className="flex flex-row mt-4 px-2">
        <span className="text-sm font-semibold text-foreground/80 mr-2">Email</span>
        <span className="text-sm font-semibold text-foreground/70 ">{displayEmail}</span>
      </div>
      <div className="flex flex-row gap-4">
        <Button
          variant="outline"
          className="w-72"
          onClick={() =>
            isConnected ? openAccountModal?.() : openConnectModal?.()
          }
        >
          Switch your connected wallet
        </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => onLogout()}
            className="w-20"
          >
            Logout
          </Button>
      </div>
      <div className="border-b border-gray-200">
        <h1 className="text-xl font-semibold leading-7 text-foreground/80">Farcaster accounts</h1>
      </div>
      <ul role="list" className="divide-y divide-white/5">
        {accounts.map((item: AccountObjectType, idx: number) => (
          <li key={item.id} className="px-2 py-2">
            <div
              className="flex items-center gap-x-3"
            >
              <h3 className={classNames(
                "text-foreground/80",
                "flex-auto truncate text-sm font-semibold leading-6")}>{item.name}</h3>
              {item.platformAccountId && item.status !== 'active' && (
                <p className="truncate text-sm text-foreground/80">
                  {item.status}
                </p>
              )}
              {item.platformAccountId && item.status === 'active' && (
                <p className="font-mono truncate text-sm text-foreground/80">
                  fid: {item.platformAccountId}
                </p>
              )}
              <Button variant="secondary" onClick={() => onClickManageAccount(item)}>Manage</Button>
              <AlertDialogDemo buttonText={`Disconnect`} onClick={() => removeAccount(idx)} />
            </div>
          </li>
        ))}
      </ul>
      <HelpCard />
      {renderInfoSection()}
      <AccountSettingsModal account={selectedAccount} open={open} setOpen={setOpen} />
    </div>
  )
}
