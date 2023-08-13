import React from "react";
import FarcasterLogin from "@/common/components/FarcasterLogin";

export default function Accounts() {
  return (
    <div className="flex min-w-full flex-col">
      <div>
        <h1 className="mb-4 text-lg font-bold tracking-tight text-gray-200 sm:text-4xl">
          Add Farcaster account
        </h1>
        <FarcasterLogin />
        {/*
          <h1 className="mt-12 text-lg font-bold tracking-tight text-gray-200 sm:text-4xl">
            Sign in via secret phrase
          </h1>
          <SecretPhraseLogin />
        */}
      </div>
      {/* <div className="mt-20 flex items-center justify-start">
        {<button
          onClick={() => onRemoveAccounts()}
          className={classNames(
            hasAccounts ? "cursor-pointer hover:bg-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-600" : "cursor-default",
            "inline-flex items-center rounded-sm bg-gray-700 px-3 py-2 text-sm font-semibold text-white shadow-sm "
          )}
        >
          Remove all accounts
        </button>}
      </div> */}
    </div>
  )
}
