import React from "react";

import { Button } from "@/components/ui/button";

import { useAccountModal, useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

export default function SwitchWalletButton() {
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();
  const { address, isConnected } = useAccount();
  
  return (
    <div className="flex flex-col max-w-xs">
    <Button variant="outline" onClick={() => openConnectModal?.() || openAccountModal?.() }>
        {/* {isConnected ? "Switch Wallet" : "Connect Wallet"} */}
        Connect / Switch wallet
      </Button>
      <span className="mt-2 text-xs text-muted-foreground">
        Connected with wallet:{' '}
        {address}
      </span>
    </div>
  );
}
