import { WarpcastLoginStatus, generateWarpcastSigner, getWarpcastSignerStatus } from "@/common/helpers/warpcastLogin";
import { hydrate, useAccountStore } from "@/stores/useAccountStore";
import isEmpty from "lodash.isempty";
import { useEffect, useLayoutEffect, useState } from "react";
import { AccountPlatformType, AccountStatusType } from "../constants/accounts";
import { Cog6ToothIcon, ExclamationCircleIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import usePollingUpdate from "../hooks/usePollingUpdate";
import { QrCode } from "./QrCode";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { useNavigate } from "react-router-dom";


const APP_NAME = "herocast";

const FarcasterLogin = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [runPolling, setRunPolling] = useState(false);

  const {
    accounts,
    addAccount,
    setAccountActive,
  } = useAccountStore();

  const {
    toFeed
  } = useNavigationStore();

  console.log('run polling', runPolling);

  const pendingAccounts = accounts.filter((account) => account.status === AccountStatusType.pending);
  const hasPendingNewAccounts = !isEmpty(pendingAccounts);

  const onPollingUpdate = async () => {
    console.log('onPollingUpdate');
    if (hasPendingNewAccounts) {
      pendingAccounts.forEach(async (account, idx) => {
        console.log('onPollingUpdate for account', account.id)
        if (!account.id) return;

        if (account.data?.signerToken) {
          const { status, data } = await getWarpcastSignerStatus(account.data.signerToken);
          console.log('signerStatus: ', status, data);
          if (status === WarpcastLoginStatus.success) {
            console.log('1');
            setAccountActive(account.id, { platform_account_id: data.fid });
            console.log('idx + 1', idx + 1, 'pendingAccounts', pendingAccounts.length);
            if (idx + 1 === pendingAccounts.length) {
              console.log('2');
              setRunPolling(false);
              console.log('3');
              await hydrate();
              console.log('4');
              toFeed();
              console.log('5');
              window.location.reload();
            }
          }
        }
      })
    }
  }

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
    if (isLoading) return;

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
      <div className="my-8 divide-y divide-gray-500">
        {pendingAccounts.map((account) => {
          const deepLinkUrl = account.data?.deepLinkUrl;
          return <div className="py-8" key={account.id}>
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
        <label htmlFor="accountName" className="block text-lg font-medium leading-6 text-gray-100">
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
              disabled={isLoading}
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
