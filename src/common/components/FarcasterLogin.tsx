import { WarpcastLoginStatus, generateWarpcastSigner, getWarpcastSignerStatus } from "@/common/helpers/warpcastLogin";
import { useAccountStore } from "@/stores/useAccountStore";
import { useCheckSigner, useSigner, useToken } from "@farsign/hooks";
import isEmpty from "lodash.isempty";
import React, { Dispatch, SetStateAction, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AccountPlatformType, AccountStatusType } from "../constants/accounts";
import { classNames } from "../helpers/css";
import { BarsArrowUpIcon, Cog6ToothIcon, ExclamationCircleIcon, UserPlusIcon, UsersIcon } from "@heroicons/react/24/outline";
import { supabaseClient } from "../helpers/supabase";
import usePollingUpdate from "../hooks/usePollingUpdate";

const QrCode = React.lazy(() =>
  import('@/common/components/QrCode')
    .then(({ QrCode }) => ({ default: QrCode })),
);

const APP_NAME = "herocast";

const FarcasterLogin = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const {
    accounts,
    addAccount,
    setAccountActive,
  } = useAccountStore();


  const pendingAccounts = accounts.filter((account) => account.status === AccountStatusType.pending);
  const hasPendingNewAccounts = !isEmpty(pendingAccounts);

  const onPollingUpdate = async () => {
    console.log('onPollingUpdate');
    if (hasPendingNewAccounts) {
      pendingAccounts.forEach(async (account) => {
        console.log('onPollingUpdate', account)
        if (!account.id) return;

        if (account.data?.signerToken) {
          const { status, data } = await getWarpcastSignerStatus(account.data.signerToken);
          if (status === WarpcastLoginStatus.success) {
            setAccountActive(account.id, { platform_account_id: data.fid });
          }
        }
      })
    }
  }
  const [runPolling, setRunPolling] = useState(false);

  useEffect(() => {
    setRunPolling(hasPendingNewAccounts);
  }, [hasPendingNewAccounts])

  usePollingUpdate(runPolling ? () => onPollingUpdate() : null, 3000);

  useLayoutEffect(() => {
    return () => {
      console.log('cleanup LayoutEffect')
      setRunPolling(false);
    }
  }, [runPolling])

  const onCreateNewAccount = async () => {
    if (!accountName) {
      setErrorMessage('Account name is required');
      return;
    }
    if (hasPendingNewAccounts || isLoading) return;

    setIsLoading(true);
    const { publicKey, privateKey, token, deepLinkUrl } = await generateWarpcastSigner(APP_NAME);
    console.log('onCreateNewAccount', publicKey, privateKey, token, deepLinkUrl);

    addAccount({
      id: null,
      platformAccountId: null,
      name: accountName,
      status: AccountStatusType.pending,
      platform: AccountPlatformType.farcaster,
      publicKey,
      privateKey,
      data: { signerToken: token, deepLinkUrl }
    });
    setIsLoading(false);
  }

  const renderPendingAccounts = () => {
    return (
      <div className="py-4">
        {pendingAccounts.map((account) => {
          const deepLinkUrl = account.data?.deepLinkUrl;
          return <div key={account.id}>
            <p className="text-xl text-gray-200">Account {account.name}</p>
            {deepLinkUrl && (
              <>
                <p className="mb-2 text-lg leading-8 text-gray-300">
                  Scan the QR code with your mobile camera app to sign in via Warpcast
                </p>
                <QrCode deepLink={deepLinkUrl} />
              </>
            )}
          </div>
        })}
      </div>)
  }

  return (
    <div>
      <div className="max-w-sm">
        <label htmlFor="email" className="block text-lg font-medium leading-6 text-gray-100">
          Display name
        </label>
        <div className="mt-2 flex rounded-sm shadow-sm">
          <div className="relative flex flex-grow items-stretch focus-within:z-10">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <UserPlusIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </div>
            <input
              name="accountName"
              id="accountName"
              disabled={hasPendingNewAccounts || isLoading}
              onChange={(e) => {
                if (errorMessage) {
                  setErrorMessage('')
                };
                setAccountName(e.target.value)
              }}
              className="block w-full rounded-none rounded-l-sm border-0 py-1.5 pl-10 bg-white/5 text-gray-200 ring-1 ring-inset ring-gray-600 placeholder:text-gray-500 focus:ring-1 focus:ring-inset focus:ring-gray-400 sm:text-sm sm:leading-6"
              placeholder="dwr.eth"
            />
            {errorMessage && (
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <ExclamationCircleIcon className="h-5 w-5 text-red-500" aria-hidden="true" />
              </div>
            )}
            {isLoading && (
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <Cog6ToothIcon className="h-5 w-5 text-gray-500 animate-spin" aria-hidden="true" />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => onCreateNewAccount()}
            className="relative -ml-px inline-flex items-center gap-x-1.5 rounded-r-sm px-3 py-2 text-sm bg-gray-700 font-semibold text-gray-200 ring-1 ring-inset ring-gray-500 hover:bg-gray-600"
          >
            Add account
          </button>
        </div>
      </div>
      {errorMessage && (
        <p className="mt-1.5 text-sm text-red-500" id="input-error">
          {errorMessage}
        </p>
      )}
      {renderPendingAccounts()}
    </div>
  )
}

export default FarcasterLogin;
