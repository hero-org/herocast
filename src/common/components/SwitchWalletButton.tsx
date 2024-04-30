import React, { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAccountModal, useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

const SwitchWalletButton = () => {
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();
  const { status, address } = useAccount();
  const x = useAccount();
  const [description, setDescription] = React.useState<string>("");

  useEffect(() => {
    if (address) {
      setDescription(
        `Connected with wallet: ${address.substring(
          0,
          6
        )}...${address.substring(address.length - 4, address.length)} - status: ${status}`
      );
    }
  }, [address, status]);

  const onClick = () => {
    if (status === "connected") {
      openAccountModal?.();
    } else {
      openConnectModal?.();
    }
  };

  return (
    <div className="flex flex-col">
      <Button variant="outline" onClick={onClick} className="w-full max-w-sm">
        Connect / Switch wallet
      </Button>
      <Label className="mt-2">{description}</Label>
    </div>
  );
};

export default SwitchWalletButton;
