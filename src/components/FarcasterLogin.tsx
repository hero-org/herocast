import React, { Dispatch, SetStateAction } from "react";
import { useCheckSigner, useToken, useSigner } from "@farsign/hooks";
import { useEffect } from 'react';

const LoginQrCode = React.lazy(() =>
  import('@src/components/LoginQrCode')
    .then(({ LoginQrCode }) => ({ default: LoginQrCode })),
);
const CLIENT_NAME = "herocast"

const FarcasterLogin = () => {
  const [isConnected, setIsConnected] = useCheckSigner(CLIENT_NAME);
  const [token] = useToken(CLIENT_NAME);
  const [signer] = useSigner(CLIENT_NAME, token);
  // const [encryptedSigner] = useEncryptedSigner(CLIENT_NAME, token);

  useEffect(() => {
    if (signer.isConnected === true) {
      (setIsConnected as Dispatch<SetStateAction<boolean>>)(true)
    }
  }, [signer])


  return (
    <>
      <div>
        {(!isConnected) ?
          <LoginQrCode deepLink={token.deepLink} />
          :
          <div className="card text-white">
            <button onClick={() => console.log('yo')}>Send cast to express your joy!</button>
          </div>
        }
      </div>
    </>
  )
}

export default FarcasterLogin;
