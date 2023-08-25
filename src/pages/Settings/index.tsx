import { CommandType } from "@/common/constants/commands";
import { supabaseClient } from "@/common/helpers/supabase";
import { accountCommands, channelCommands, useAccountStore } from "@/stores/useAccountStore";
import { newPostCommands } from "@/stores/useNewPostStore";
import { User } from "@supabase/supabase-js";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type SimpleCommand = {
  name: string;
  shortcut: string;
}

export default function Settings() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null)

  const {
    resetStore
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
      const res = await supabaseClient.auth.signOut();
    }

    navigate('/login');
  }

  const displayEmail = user?.email ? `${user?.email.slice(0, 5)}...@${user?.email.split('@')[1]}` : '';

  const renderInfoSection = () => {
    let commands: SimpleCommand[] = [
      { name: 'Command Palette', shortcut: 'cmd+k' },
      { name: 'Feed: go to previous cast in list', shortcut: 'k' },
      { name: 'Feed: go to next cast in list', shortcut: 'j' },
      { name: 'Feed: Open thread view for cast', shortcut: 'Enter or o' },
      { name: 'Feed: Open embedded link in new tab', shortcut: 'shift+o' },
      // ...navigationCommands,
      ...newPostCommands,
      ...accountCommands,
      ...channelCommands,
    ];

    return (<div className="overflow-hidden shadow sm:rounded-lg">
      <div className="px-2 py-4">
        <h3 className="text-base font-semibold leading-7 text-gray-100">hotkeys overview</h3>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-400">list of all hotkeys in herocast</p>
      </div>
      <div className="border-t border-gray-600">
        <dl className="divide-y divide-gray-600">
          {commands.map((command) => (
            <div className="px-2 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-100">{command.name}</dt>
              <dd className="mt-1 text-sm leading-6 text-gray-200 sm:col-span-1 sm:mt-0">{command.shortcut.replace(/\+/g, ' + ')}</dd>
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
    <div className="flex flex-col">
      <div className="flex flex-row mb-4">
        <span className="text-sm font-semibold text-gray-400 mr-2">User</span>
        <span className="text-sm font-semibold text-white">{displayEmail}</span>
      </div>
      <button
        type="button"
        onClick={() => onLogout()}
        className="w-48 inline-flex items-center rounded-sm bg-gray-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600"
      >
        Logout
      </button>
      {renderInfoSection()}
    </div>
  )
}
