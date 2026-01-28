import { ID_REGISTRY_ADDRESS, idRegistryABI } from '@farcaster/hub-web';
import { CheckCircleIcon, Cog6ToothIcon } from '@heroicons/react/20/solid';
import { useAccountModal } from '@rainbow-me/rainbowkit';
import { getChainId, writeContract } from '@wagmi/core';
import isEmpty from 'lodash.isempty';
import { useCallback, useEffect, useState } from 'react';
import { useAccount, useReadContract, useSwitchChain, useWaitForTransactionReceipt } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { type AccountObjectType, hydrateAccounts, useAccountStore } from '@/stores/useAccountStore';
import { KEY_GATEWAY } from '../constants/contracts/key-gateway';
import { KEY_REGISTRY } from '../constants/contracts/key-registry';
import { optimismChainId } from '../helpers/env';
import { getSignedKeyRequestMetadataFromAppAccount } from '../helpers/farcaster';
import { config } from '../helpers/rainbowkit';
import SwitchWalletButton from './SwitchWalletButton';

const KEY_STATE_ADDED = 1;

const APP_FID = process.env.NEXT_PUBLIC_APP_FID!;

type ConfirmOnchainSignerButtonType = {
  account: AccountObjectType;
};

const ConfirmOnchainSignerButton = ({ account }: ConfirmOnchainSignerButtonType) => {
  const { openAccountModal } = useAccountModal();

  const chainId = getChainId(config);
  const { switchChain } = useSwitchChain();
  const [addKeyTx, setAddKeyTx] = useState<`0x${string}`>();

  const { address } = useAccount();
  const { data: idOfUser, error: idOfUserError } = useReadContract({
    abi: idRegistryABI,
    address: ID_REGISTRY_ADDRESS,
    chainId: optimismChainId,
    functionName: address ? 'idOf' : undefined,
    args: address ? [address] : undefined,
  });

  const isWalletOwnerOfFid = idOfUser !== 0n;
  const isConnectedToOptimism = address && chainId === optimismChainId;
  if (idOfUserError) console.log('idOfUserError', idOfUserError);

  const shouldCheckKeyRegistry = isWalletOwnerOfFid && !!account?.publicKey;
  const { data: keyData, isLoading: isCheckingKeyRegistry } = useReadContract({
    address: KEY_REGISTRY.address,
    abi: KEY_REGISTRY.abi,
    chainId: KEY_REGISTRY.chainId,
    functionName: 'keyDataOf',
    args: shouldCheckKeyRegistry ? [BigInt(idOfUser!.toString()), account.publicKey as `0x${string}`] : undefined,
    query: {
      staleTime: 5 * 60 * 1000,
      enabled: shouldCheckKeyRegistry,
    },
  });

  const isKeyAlreadyRegistered =
    keyData && typeof keyData === 'object' && 'state' in keyData && Number(keyData.state) === KEY_STATE_ADDED;

  const { setAccountActive } = useAccountStore();
  const enabled = !isEmpty(account);
  const deadline = Math.floor(Date.now() / 1000) + 86400; // signature is valid for 1 day

  const getMetadata = useCallback(async () => {
    if (!account || !account.publicKey) return;
    // getSignedKeyRequestMetadataFromAppAccount returns fully encoded metadata
    // ready to be passed to the KeyGateway.add() function
    return getSignedKeyRequestMetadataFromAppAccount(chainId, account.publicKey, deadline);
  }, [account, chainId, deadline]);

  const {
    data: addKeyTxReceipt,
    isSuccess: isAddKeyTxSuccess,
    isLoading: isAddKeyTxLoading,
    isPending: addKeySignPending,
    error: addKeyError,
  } = useWaitForTransactionReceipt({ hash: addKeyTx });

  useEffect(() => {
    const setupAccount = async () => {
      if (!isWalletOwnerOfFid) return;

      try {
        const response = await fetch(`/api/users?fids=${idOfUser}&viewer_fid=${APP_FID}`);
        if (!response.ok) {
          console.error('Failed to fetch user:', response.status);
          return;
        }
        const data = await response.json();
        const user = data.users?.[0];
        if (!user) {
          console.error('No user found for FID:', idOfUser);
          return;
        }
        await setAccountActive(account.id, user.username, {
          platform_account_id: user.fid.toString(),
        });
        await hydrateAccounts();
        window.location.reload();
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };
    if (isAddKeyTxSuccess || isKeyAlreadyRegistered) {
      setupAccount();
    }
  }, [idOfUser, isAddKeyTxSuccess, isKeyAlreadyRegistered]);

  console.log(
    'addKeyTxReceipt',
    addKeyTxReceipt,
    'isAddKeyTxSuccess',
    isAddKeyTxSuccess,
    'isAddKeyTxLoading',
    isAddKeyTxLoading,
    'addKeySignPending',
    addKeySignPending,
    'addKeyError',
    addKeyError
  );

  const onClick = async () => {
    if (chainId !== optimismChainId) {
      switchChain?.({ chainId: optimismChainId });
    } else if (!isWalletOwnerOfFid) {
      openAccountModal?.();
    } else {
      try {
        // getMetadata returns fully encoded ABI metadata from getSignedKeyRequestMetadataFromAppAccount
        // which includes requestFid, requestSigner, signature, and deadline - ready to use directly
        const metadata = await getMetadata();
        if (!metadata) {
          throw new Error('Failed to get metadata to confirm onchain account');
        }
        console.log('metadata', metadata);
        const addKeyTx = await writeContract(config, {
          ...KEY_GATEWAY,
          functionName: 'add',
          args: [
            1, // keyType: 1 = EdDSA
            account.publicKey as `0x${string}`,
            1, // metadataType: 1 = SignedKeyRequest
            metadata, // Already encoded, use directly
          ],
        });
        setAddKeyTx(addKeyTx);
      } catch (e) {
        console.error('Error submitting message: ', e);
      }
    }
  };

  const isError = addKeyError !== null;

  const getButtonText = () => {
    // if (addKeySignPending) return 'Waiting for you to sign in your wallet'
    if (chainId !== optimismChainId) return 'Switch to Optimism';
    if (isCheckingKeyRegistry) return 'Checking onchain status...';
    if (isKeyAlreadyRegistered) return 'Key found - activating account...';
    if (isAddKeyTxLoading) return 'Waiting for onchain transaction to be confirmed';
    if (isAddKeyTxSuccess) return 'Confirmed onchain';
    // if (prepareToAddKeyError) return 'Failed to prepare onchain request'
    if (addKeyError) return 'Failed to execute onchain request';
    return 'Confirm account onchain';
  };

  return (
    <div className="flex flex-col gap-5">
      {!isWalletOwnerOfFid && (
        <Label className="font-semibold text-red-600">Connect a wallet that owns a Farcaster account.</Label>
      )}
      <Button
        variant="default"
        className="w-full"
        onClick={() => onClick()}
        disabled={
          !enabled ||
          (isConnectedToOptimism && !isWalletOwnerOfFid) ||
          isCheckingKeyRegistry ||
          isAddKeyTxSuccess ||
          isKeyAlreadyRegistered ||
          isError
        }
      >
        {getButtonText()}
        {(isCheckingKeyRegistry || isAddKeyTxLoading || isKeyAlreadyRegistered) && (
          <Cog6ToothIcon className="ml-1.5 h-5 w-5 text-foreground/80 animate-spin" aria-hidden="true" />
        )}
        {isAddKeyTxSuccess && <CheckCircleIcon className="ml-1.5 h-6 w-6 text-green-600" aria-hidden="true" />}
      </Button>
      {!isAddKeyTxSuccess && <SwitchWalletButton />}
    </div>
  );
};

export default ConfirmOnchainSignerButton;

// todo:
// - fix
// - skip getSignerRequestStatus in warpcastQR code login when this isn't actually active
