import React, { useEffect, useLayoutEffect, useState } from "react";
import { WarpcastLoginStatus, createSignerRequest, generateWarpcastSigner, getWarpcastSignerStatus } from "@/common/helpers/warpcastLogin";
import { hydrate, useAccountStore } from "@/stores/useAccountStore";
import isEmpty from "lodash.isempty";
import { AccountPlatformType, AccountStatusType } from "../constants/accounts";
import { Cog6ToothIcon, ExclamationCircleIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import usePollingUpdate from "../hooks/usePollingUpdate";
import { QrCode } from "./QrCode";
import { useHotkeys } from "react-hotkeys-hook";


const WarpcastLogin = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [isSignupDone, setIsSignupDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [runPolling, setRunPolling] = useState(false);

  const {
    accounts,
    addAccount,
    setAccountActive,
  } = useAccountStore();

  const pendingAccounts = accounts.filter((account) => account.status === AccountStatusType.pending && account.platform === AccountPlatformType.farcaster);
  const hasPendingNewAccounts = !isEmpty(pendingAccounts);

  useEffect(() => {
    if (hasPendingNewAccounts && !isSignupDone) {
      setRunPolling(true);
    } else {
      setRunPolling(false);
    }
  }, [hasPendingNewAccounts])

  const onPollingUpdate = async () => {
    if (hasPendingNewAccounts && !isSignupDone) {
      pendingAccounts.forEach(async (account, idx) => {
        if (!account.id) return;

        if (account.data?.signerToken) {
          const { status, data } = await getWarpcastSignerStatus(account.data.signerToken);
          console.log('signerStatus: ', status, data);
          if (status === WarpcastLoginStatus.success) {
            await setAccountActive(account.id, { platform_account_id: data.userFid, data });
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
    if (!accountName) {
      setErrorMessage('Account name is required');
      return;
    }
    if (isLoading) return;
    setIsLoading(true);
    
    const { publicKey, privateKey, signature, requestFid, deadline } = await generateWarpcastSigner();
    const { token, deeplinkUrl } = await createSignerRequest(publicKey, requestFid, signature, deadline);

    try {
      await addAccount({
        account: {
          platformAccountId: undefined,
          name: accountName,
          status: AccountStatusType.pending,
          platform: AccountPlatformType.farcaster,
          publicKey,
          privateKey,
          data: { signerToken: token, deeplinkUrl }
        }
      });
    } catch (e) {
      console.log('error when trying to add account', e);
      setErrorMessage(`Error when trying to add account ${e}`);
    }
    setIsLoading(false);
  }

  useHotkeys(['meta+enter', 'enter'], () => onCreateNewAccount(), [accountName], { enableOnFormTags: true });

  const renderPendingAccounts = () => {
    return (
      <div className="my-8 divide-y divide-gray-500">
        {pendingAccounts.map((account) => {
          const signerToken = account.data?.signerToken;

          return <div className="py-8" key={account.id}>
            <p className="text-xl text-gray-200">Account {account.name}</p>
            {signerToken && (
              <>
                <p className="mb-2 text-lg leading-8 text-foreground/80">
                  Scan the QR code with your mobile camera app to sign in via Warpcast
                </p>
                <QrCode deepLink={`https://client.warpcast.com/deeplinks/signed-key-request?token=${signerToken}`} />
              </>
            )}
          </div>
        })}
      </div>)
  }

  return (
    <div>
      <div className="max-w-md">
        <label htmlFor="accountName" className="block text-lg font-medium leading-6 text-foreground/80">
          Display name
        </label>
        <div className="mt-2 flex rounded-sm shadow-sm">
          <div className="relative flex flex-grow items-stretch focus-within:z-10">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <UserPlusIcon className="h-5 w-5 text-foreground/70" aria-hidden="true" />
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
              className="block w-full rounded-none rounded-l-sm border-0 py-1.5 pl-10 bg-white/5 text-gray-200 ring-1 ring-inset ring-gray-600 placeholder:text-foreground/80 focus:ring-1 focus:ring-inset focus:ring-gray-400 sm:text-sm sm:leading-6"
              placeholder="dwr.eth"
            />
            {errorMessage && (
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <ExclamationCircleIcon className="h-5 w-5 text-red-500" aria-hidden="true" />
              </div>
            )}
            {isLoading && (
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <Cog6ToothIcon className="h-5 w-5 text-foreground/80 animate-spin" aria-hidden="true" />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => onCreateNewAccount()}
            className="relative -ml-px inline-flex items-center gap-x-1.5 rounded-r-sm px-3 py-2 text-sm bg-gray-700 font-semibold text-gray-200 ring-1 ring-inset ring-gray-500 hover:bg-gray-600"
          >
            Connect account
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

export default WarpcastLogin;
