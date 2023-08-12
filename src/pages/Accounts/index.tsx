import React from "react";
import FarcasterLogin from "@/common/components/FarcasterLogin";
import { classNames } from "@/common/helpers/css";
import { useAccountStore } from "@/stores/useAccountStore";
import SecretPhraseLogin from "@/common/components/SecretPhraseLogin";

export default function Accounts() {
  const {
    accounts,
    removeAccount,
  } = useAccountStore();


  const hasAccounts = (accounts && accounts.length > 0) || localStorage.getItem("farsign-signer-herocast") !== null;
  const onRemoveAccounts = () => {
    if (!hasAccounts) return;

    localStorage.removeItem("farsign-signer-herocast");
    localStorage.removeItem("farsign-privateKey-herocast");

    for (let idx = 0; idx <= accounts.length; idx++) {
      removeAccount(idx);
    }
  };

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
