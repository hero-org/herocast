import React, { } from "react";
import { useAccountStore } from "@/stores/useAccountStore";


const SecretPhraseLogin = () => {
  const {
    accounts,
    addAccount,
    removeAccount,
  } = useAccountStore();
  const [accountToAddIdx, setAccountToAddIdx] = React.useState<number>(accounts ? accounts.length : 0);

  return (
    <div className="mt-5">
      <div className="max-w-xl text-lg text-gray-300">
        <p>Enter your twelve word seed phrase to connect to Farcaster.</p>
      </div>
      <form className="mt-2 sm:flex sm:items-center">
        <div className="w-full sm:max-w-xs">
          <label htmlFor="email" className="sr-only">
            Secret phrase
          </label>
          <input
            id="secret-phrase"
            name="secret_phrase"
            type="password"
            className="block w-full rounded-sm border-0 bg-white/5 py-1.5 text-gray-200 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-gray-600 sm:text-sm sm:leading-6"
          />
        </div>
        <button
          type="submit"
          className="mt-3 inline-flex w-full items-center justify-center rounded-sm bg-gray-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 sm:ml-3 sm:mt-0 sm:w-auto"
        >
          Save
        </button>
      </form>
    </div>
  )
}

export default SecretPhraseLogin;
