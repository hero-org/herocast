import React from "react";
import WarpcastLogin from "@/common/components/WarpcastLogin";
import WalletLogin from "@/common/components/WalletLogin";
import { CheckCircleIcon, PlusCircleIcon, RectangleGroupIcon } from "@heroicons/react/20/solid";
import { NewspaperIcon } from "@heroicons/react/24/solid";
import { JoinedHerocastPostDraft, useNewPostStore } from "@/stores/useNewPostStore";
import { useAccountStore } from "@/stores/useAccountStore";
import isEmpty from "lodash.isempty";
import { AccountStatusType } from "@/common/constants/accounts";
import { useNavigate } from "react-router-dom";

export default function Accounts() {
  const navigate = useNavigate();

  const {
    accounts,
  } = useAccountStore();

  const {
    addNewPostDraft,
  } = useNewPostStore();

  const hasActiveAccounts = !isEmpty(accounts.filter((account) => account.status === AccountStatusType.active));

  const onStartCasting = () => {
    addNewPostDraft(JoinedHerocastPostDraft)
    navigate('/post');
  }

  return (
    <div className="ml-4 flex min-w-full flex-col">
      <div>
        <h1 className="mb-4 text-lg font-bold tracking-tight text-gray-200 sm:text-4xl">
          Connect Farcaster accounts
        </h1>
        <WarpcastLogin />
        <WalletLogin />
      </div>
      {hasActiveAccounts && (<div className="mt-10 max-w-xl rounded-sm bg-green-800/50 px-4 py-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <CheckCircleIcon className="h-5 w-5 text-gray-100" aria-hidden="true" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-gray-100">Account added to herocast</h3>
            <div className="mt-2 text-sm text-gray-300">
              <p>You can start casting and browsing your feed</p>
            </div>
            <div className="mt-4">
              <div className="-mx-2 -my-1.5 flex">
                <button
                  onClick={() => onStartCasting()}
                  type="button"
                  className="flex rounded-sm bg-gray-600 px-2 py-1.5 text-sm font-medium text-gray-100 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
                >
                  Start casting
                  <PlusCircleIcon className="ml-1.5 mt-0.5 h-4 w-4 text-gray-100" aria-hidden="true" />
                </button>
                <button
                  onClick={() => navigate('/feed')}
                  type="button"
                  className="ml-4 flex rounded-sm bg-gray-600 px-2 py-1.5 text-sm font-medium text-gray-100 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
                >
                  Scroll your feed
                  <NewspaperIcon className="ml-1.5 mt-0.5 h-4 w-4 text-gray-100" aria-hidden="true" />
                </button>
                <button
                  onClick={() => navigate('/channels')}
                  type="button"
                  className="ml-4 flex rounded-sm bg-gray-600 px-2 py-1.5 text-sm font-medium text-gray-100 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
                >
                  Pin your favourite channels
                  <RectangleGroupIcon className="ml-1.5 mt-0.5 h-4 w-4 text-gray-100" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>)}
    </div>
  )
}
