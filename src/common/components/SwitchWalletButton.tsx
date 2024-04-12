import React, { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAccountModal, useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

const SwitchWalletButton = () => {
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();
  const { address } = useAccount();
  const [description, setDescription] = React.useState<string>("");

  useEffect(() => {
    if (address) {
      setDescription(`Connected with wallet: ${address}`);
    }
  }, [address]);

  return (
    <div className="flex flex-col">
      <Button
        variant="outline"
        onClick={() => openConnectModal?.() || openAccountModal?.()}
      >
        Connect / Switch wallet
      </Button>
      <Label className="mt-2">{description}</Label>
    </div>
  );
}

export default SwitchWalletButton;