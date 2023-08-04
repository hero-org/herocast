import React, { Dispatch, SetStateAction } from "react";
import { useCheckSigner, useToken, useSigner } from "@farsign/hooks";
import { useEffect } from 'react';
import { ACCOUNTS_ATOM_KEY, atomWithLocalStorage } from "@src/state";
import { useAtom } from "jotai";

const LoginQrCode = React.lazy(() =>
  import('@src/components/LoginQrCode')
    .then(({ LoginQrCode }) => ({ default: LoginQrCode })),
);
const CLIENT_NAME = "herocast"

const accountsAtom = atomWithLocalStorage(ACCOUNTS_ATOM_KEY, {})

const FarcasterLogin = () => {
  const [isConnected, setIsConnected] = useCheckSigner(CLIENT_NAME);
  const [token] = useToken(CLIENT_NAME);
  const [signer] = useSigner(CLIENT_NAME, token);
  // const [encryptedSigner] = useEncryptedSigner(CLIENT_NAME, token);

  const [accounts, setAccounts] = useAtom(accountsAtom)

  useEffect(() => {
    if (signer.isConnected === true) {
      (setIsConnected as Dispatch<SetStateAction<boolean>>)(true);
      const { signerRequest } = signer;
      const accountObject = {
        ...signerRequest,
        timestampString: new Date(signerRequest.timestamp).toString().split(' GMT')[0],
        username: signerRequest.publicKey.slice(0, 7) + '...' + signerRequest.publicKey.slice(-5)
      }
      setAccounts({
        ...accounts,
        [signerRequest.publicKey]: accountObject
      });
    }
  }, [signer])


  return (
    <div>
      <LoginQrCode deepLink={token.deepLink} />
    </div>
  )
}

export default FarcasterLogin;
