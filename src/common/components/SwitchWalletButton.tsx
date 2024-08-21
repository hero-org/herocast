import React, { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useAccountModal, useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount, useDisconnect } from 'wagmi';
import { cn } from '@/lib/utils';

type SwitchWalletButtonProps = {
  className?: string;
};

const SwitchWalletButton = ({ className }: SwitchWalletButtonProps) => {
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();

  const { address, isConnected } = useAccount();
  const [isClient, setIsClient] = useState<boolean>(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <div className={cn('flex flex-col', className)}>
      {isClient && isConnected && (
        <Button variant="outline" className="border-red-700" onClick={() => disconnect()}>
          Disconnect
        </Button>
      )}

      <Button
        type="button"
        variant="outline"
        className={`${isClient && isConnected ? 'mt-2' : ''}`}
        onClick={() => openConnectModal?.() || openAccountModal?.()}
      >
        {`${
          isClient && isConnected
            ? `Connected to ${address.substring(0, 6)}...${address.substring(address.length - 4, address.length)}`
            : 'Connect wallet'
        }`}
      </Button>
    </div>
  );
};

export default SwitchWalletButton;
