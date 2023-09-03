import React, { useEffect, useLayoutEffect, useState } from "react";
import { WarpcastLoginStatus, generateWarpcastSigner, getWarpcastSignerStatus } from "@/common/helpers/warpcastLogin";
import { hydrate, useAccountStore } from "@/stores/useAccountStore";
import isEmpty from "lodash.isempty";
import { AccountPlatformType, AccountStatusType } from "../constants/accounts";
import { Cog6ToothIcon, ExclamationCircleIcon, PlusCircleIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import usePollingUpdate from "../hooks/usePollingUpdate";
import { QrCode } from "./QrCode";
import { useHotkeys } from "react-hotkeys-hook";
import { useNavigate } from "react-router-dom";
import { CheckCircleIcon } from "@heroicons/react/20/solid";
import { NewspaperIcon } from "@heroicons/react/24/solid";
import { JoinedHerocastPostDraft, useNewPostStore } from "@/stores/useNewPostStore";


const FarcasterLogin = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [isSignupDone, setIsSignupDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [runPolling, setRunPolling] = useState(false);

  const navigate = useNavigate();

  const {
    accounts,
    addAccount,
    setAccountActive,
  } = useAccountStore();

  const {
    addNewPostDraft,
  } = useNewPostStore();


  const onPollingUpdate = async () => {
    const accounts = useAccountStore.getState().accounts;
    const pendingAccounts = accounts.filter((account) => account.status === AccountStatusType.pending);
    const hasPendingNewAccounts = !isEmpty(pendingAccounts);

    if (hasPendingNewAccounts && !isSignupDone) {
      pendingAccounts.forEach(async (account, idx) => {
        if (!account.id) return;

        if (account.data?.signerToken) {
          const { status, data } = await getWarpcastSignerStatus(account.data.signerToken);
          console.log('signerStatus: ', status, data);
          if (status === WarpcastLoginStatus.success) {
            setAccountActive(account.id, { platform_account_id: data.userFid, data });
            // console.log('idx + 1', idx + 1, 'pendingAccounts', pendingAccounts.length);
            if (idx + 1 === pendingAccounts.length) {
              setRunPolling(false);
              await hydrate();
              setIsSignupDone(true);
              window.location.reload();
            }
          }
        }
      })
    }
  }

  usePollingUpdate(runPolling ? () => onPollingUpdate() : null, 3000);

  useLayoutEffect(() => {
    return () => {
      setRunPolling(false);
    }
  }, [runPolling])

  const onCreateNewAccount = async () => {
    console.log('onCreateNewAccount', accountName);
    if (!accountName) {
      setErrorMessage('Account name is required');
      return;
    }
    if (isLoading) return;

    setIsLoading(true);
    const { publicKey, privateKey, token, deeplinkUrl } = await generateWarpcastSigner();
    console.log('onCreateNewAccount', publicKey, privateKey, token, deeplinkUrl);

    try {
      addAccount({
        id: null,
        platformAccountId: null,
        name: accountName,
        status: AccountStatusType.pending,
        platform: AccountPlatformType.farcaster,
        publicKey,
        privateKey,
        data: { signerToken: token, deeplinkUrl }
      });
    } catch (e) {
      console.log('error when trying to add account', e);
      setErrorMessage(`Error when trying to add account ${e}`);
    }
    setIsLoading(false);
  }

  useHotkeys(['meta+enter', 'enter'], () => onCreateNewAccount(), [accountName], { enableOnFormTags: true });

  const onStartCasting = () => {
    addNewPostDraft(JoinedHerocastPostDraft)
    navigate('/post');
  }

  const pendingAccounts = accounts.filter((account) => account.status === AccountStatusType.pending);

  const renderPendingAccounts = () => {
    return (
      <div className="my-8 divide-y divide-gray-500">
        {pendingAccounts.map((account) => {
          const deepLinkUrl = account.data?.deeplinkUrl;
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
      <div className="max-w-md">
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
                }
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
      {accounts.length > 0 && (<div className="mt-10 max-w-md rounded-sm bg-green-800/50 px-4 py-6">
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
              </div>
            </div>
          </div>
        </div>
      </div>)}
      {renderPendingAccounts()}
    </div>
  )
}

export default FarcasterLogin;
