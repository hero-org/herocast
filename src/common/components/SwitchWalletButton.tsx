import React, { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAccountModal, useConnectModal} from "@rainbow-me/rainbowkit";
import { useAccount, useDisconnect } from "wagmi";

const SwitchWalletButton = () => {
  const { disconnect }       = useDisconnect()
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();
  const { address, isConnected } = useAccount();
  const [ isClient, setIsClient ] = useState<boolean>(false);

  useEffect(() => {
    setIsClient(true)
  }, [])

  return (
    <div className="flex flex-col">
      { (isClient && isConnected) && (
        <Button
          variant="destructive"
          onClick={() => disconnect() }
        >Disconnect</Button>
      )
      }
      
      <Button
        variant="outline"
        className={`${(isClient && isConnected) ? 'mt-2' : ''}`}
        onClick={() => openConnectModal?.() || openAccountModal?.()}
      >
        {`${(isClient && isConnected) ? `Connected to ${address}` : 'Connect wallet' }`}
      </Button>
    </div>
  );
}

export default SwitchWalletButton;