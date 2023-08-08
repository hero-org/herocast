import React, { Dispatch, SetStateAction } from "react";
import { useCheckSigner, useToken, useSigner } from "@farsign/hooks";
import { useEffect } from 'react';

const QrCode = React.lazy(() =>
  import('@/common/components/QrCode')
    .then(({ QrCode }) => ({ default: QrCode })),
);
const CLIENT_NAME = "herocast"

// const accountsAtom = atomWithLocalStorage(ACCOUNTS_ATOM_KEY, {})

const FarcasterLogin = () => {
  const [isConnected, setIsConnected] = useCheckSigner(CLIENT_NAME);
  const [token] = useToken(CLIENT_NAME);
  const [signer] = useSigner(CLIENT_NAME, token);
  // const [encryptedSigner] = useEncryptedSigner(CLIENT_NAME, token);

  // const [accounts, setAccounts] = useAtom(accountsAtom)

  useEffect(() => {
    if (signer.isConnected === true) {
      (setIsConnected as Dispatch<SetStateAction<boolean>>)(true);
      const { signerRequest } = signer;
      const accountObject = {
        ...signerRequest,
        timestampString: new Date(signerRequest.timestamp).toString().split(' GMT')[0],
        username: signerRequest.publicKey.slice(0, 7) + '...' + signerRequest.publicKey.slice(-5)
      }
      // setAccounts({
      //   ...accounts,
      //   [signerRequest.publicKey]: accountObject
      // });
    }
  }, [signer])


  return (
    <div>
      <h1 className="max-w-lg text-2xl font-bold tracking-tight text-gray-200 sm:text-4xl">
        Sign in with Farsign
      </h1>
      <p className="my-4 text-lg leading-8 text-gray-300">
        Scan the QR code with your mobile camera app to sign in
      </p>
      <QrCode deepLink={token.deepLink} />
    </div>
  )
}

export default FarcasterLogin;
