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

type SimpleCommand = {
  name: string;
  shortcut: string;
}

export default function Settings() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

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

  const onUpdateAccountStatus = () => {
    console.log('onUpdateAccountStatus')
  }

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

  const renderInfoSection = () => {
    const commands: SimpleCommand[] = [
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

    return (<div className="mt-20 overflow-hidden">
      <div className="border-b border-gray-200">
        <h1 className="text-xl font-semibold leading-7 text-gray-100">Hotkeys / Keyboard Shortcuts</h1>
      </div>
      <div className="px-2 py-4">
        <h3 className="text-base font-semibold leading-7 text-gray-100">hotkeys overview</h3>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-400">list of all hotkeys in herocast</p>
      </div>
      <div className="border-t border-gray-600">
        <dl className="divide-y divide-gray-600">
          {commands.map((command) => (
            <div key={`command-${command.name}`} className="px-2 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-100">{command.name}</dt>
              {command.shortcut && <dd className="mt-1 text-sm leading-6 text-gray-200 sm:col-span-1 sm:mt-0">{command.shortcut.replace(/\+/g, ' + ')}</dd>}
            </div>
          ))}
          {/* <div className="px-2 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-100">About</dt>
            <dd className="mt-1 text-sm leading-6 text-gray-300 sm:col-span-2 sm:mt-0">
              Fugiat ipsum ipsum deserunt culpa aute sint do nostrud anim incididunt cillum culpa consequat. Excepteur
              qui ipsum aliquip consequat sint. Sit id mollit nulla mollit nostrud in ea officia proident. Irure nostrud
              pariatur mollit ad adipisicing reprehenderit deserunt qui eu.
            </dd>
          </div> */}
        </dl>
      </div>
    </div>);
  }

  return (
    <div className="flex flex-col space-y-4">
      <div className="border-b border-gray-200">
        <h1 className="text-xl font-semibold leading-7 text-gray-100">Herocast account</h1>
      </div>
      <div className="flex flex-row mt-4 px-2">
        <span className="text-sm font-semibold text-gray-100 mr-2">Email</span>
        <span className="text-sm font-semibold text-gray-400 ">{displayEmail}</span>
      </div>
      <button
        type="button"
        onClick={() => onLogout()}
        className="w-20 inline-flex items-center rounded-sm bg-gray-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600"
      >
        Logout
      </button>
      {/* <button
        type="button"
        onClick={() => onUpdateAccountStatus()}
        className="w-48 inline-flex items-center rounded-sm bg-gray-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600"
      >
        Update Account Status
      </button> */}
      <div className="border-b border-gray-200">
        <h1 className="text-xl font-semibold leading-7 text-gray-100">Farcaster accounts</h1>
      </div>
      <ul role="list" className="divide-y divide-white/5">
        {accounts.map((item: AccountObjectType, idx: number) => (
          <li key={item.id} className="px-2 py-2">
            <div
              className="flex items-center gap-x-3"
            >
              <h3 className={classNames(
                "text-gray-100",
                "flex-auto truncate text-sm font-semibold leading-6")}>{item.name}</h3>
              <span className="text-gray-400">{item.status}</span>
              {item.platformAccountId && item.status === 'active' && (
                <p className="truncate text-sm text-gray-500">
                  fid {item.platformAccountId}
                </p>
              )}
              <AlertDialogDemo buttonText={`Disconnect`} onClick={() => removeAccount(idx)} />
            </div>
          </li>
        ))}
      </ul>
      <HelpCard />
      {renderInfoSection()}
    </div>
  )
}
