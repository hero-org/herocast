import React, { useCallback, useEffect, useState } from "react";
import { encodeAbiParameters } from "viem";
import {
  useAccount,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
} from "wagmi";
import { Button } from "@/components/ui/button";
import { ID_REGISTRY } from "../constants/contracts/id-registry";
import { mnemonicToAccount } from "viem/accounts";
import {
  AccountObjectType,
  hydrate,
  useAccountStore,
} from "@/stores/useAccountStore";
import isEmpty from "lodash.isempty";
import { useAccountModal } from "@rainbow-me/rainbowkit";
import { getChainId } from "@wagmi/core";
import { config } from "../helpers/rainbowkit";
import { writeContract } from "@wagmi/core";
import SwitchWalletButton from "./SwitchWalletButton";
import { KEY_GATEWAY } from "../constants/contracts/key-gateway";
import { getSignedKeyRequestMetadataFromAppAccount } from "../helpers/farcaster";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { Label } from "@/components/ui/label";
import { optimismChainId } from "../helpers/env";

const APP_FID = process.env.NEXT_PUBLIC_APP_FID!;
const APP_MNENOMIC = process.env.NEXT_PUBLIC_APP_MNENOMIC!;

const SIGNED_KEY_REQUEST_TYPE_V2 = [
  {
    components: [
      {
        internalType: "uint256",
        name: "requestFid",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "requestSigner",
        type: "address",
      },
      {
        internalType: "bytes",
        name: "signature",
        type: "bytes",
      },
      {
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
    ],
    internalType: "struct SignedKeyRequestValidator.SignedKeyRequestMetadata",
    name: "metadata",
    type: "tuple",
  },
] as const;

type ConfirmOnchainSignerButtonType = {
  account: AccountObjectType;
};

const ConfirmOnchainSignerButton = ({
  account,
}: ConfirmOnchainSignerButtonType) => {
  const { openAccountModal } = useAccountModal();

  const chainId = getChainId(config);
  const { switchChain } = useSwitchChain();
  const [addKeyTx, setAddKeyTx] = useState<`0x${string}`>();

  const { address } = useAccount();
  const { data: idOfUser, error: idOfUserError } = useReadContract({
    ...ID_REGISTRY,
    chainId: optimismChainId,
    functionName: address ? "idOf" : undefined,
    args: address ? [address] : undefined,
  });

  const isWalletOwnerOfFid = idOfUser !== 0n;
  const isConnectedToOptimism = address && chainId === optimismChainId;
  if (idOfUserError) console.log("idOfUserError", idOfUserError);

  const { setAccountActive } = useAccountStore();
  const appAccount = mnemonicToAccount(APP_MNENOMIC);
  const enabled = !isEmpty(account);
  const deadline = Math.floor(Date.now() / 1000) + 86400; // signature is valid for 1 day

  const getSignature = useCallback(async () => {
    if (!account || !account.publicKey) return;
    return getSignedKeyRequestMetadataFromAppAccount(
      chainId,
      account.publicKey,
      deadline
    );
  }, [account, deadline]);

  const {
    data: addKeyTxReceipt,
    isSuccess: isAddKeyTxSuccess,
    isLoading: isAddKeyTxLoading,
    isPending: addKeySignPending,
    error: addKeyError,
  } = useWaitForTransactionReceipt({ hash: addKeyTx });

  useEffect(() => {
    const setupAccount = async () => {
      if (!isAddKeyTxLoading || !isWalletOwnerOfFid) return;

      const neynarClient = new NeynarAPIClient(
        process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
      );
      const user = (
        await neynarClient.fetchBulkUsers([Number(idOfUser)], {
          viewerFid: Number(APP_FID!),
        })
      ).users[0];
      await setAccountActive(account.id, user.username, {
        platform_account_id: user.fid.toString(),
      });
      hydrate();
    };
    if (isAddKeyTxSuccess) {
      setupAccount();
    }
  }, [idOfUser, isAddKeyTxSuccess]);

  console.log(
    "addKeyTxReceipt",
    addKeyTxReceipt,
    "isAddKeyTxSuccess",
    isAddKeyTxSuccess,
    "isAddKeyTxLoading",
    isAddKeyTxLoading,
    "addKeySignPending",
    addKeySignPending,
    "addKeyError",
    addKeyError
  );

  const onClick = async () => {
    console.log("2", optimismChainId)
    if (chainId !== optimismChainId) {
      switchChain?.({ chainId: optimismChainId });
    } else if (!isWalletOwnerOfFid) {
      openAccountModal?.();
    } else {
      try {
        const signature = await getSignature();
        if (!signature) {
          throw new Error("Failed to get signature to confirm onchain account");
        }
        console.log("signature", signature);
        const addKeyTx = await writeContract(config, {
          ...KEY_GATEWAY,
          functionName: "add",
          args: [
            1,
            account.publicKey as `0x${string}`,
            1,
            encodeAbiParameters(SIGNED_KEY_REQUEST_TYPE_V2, [
              {
                requestFid: BigInt(APP_FID),
                requestSigner: appAccount.address,
                signature: signature,
                deadline: BigInt(deadline),
              },
            ]),
          ],
        });
        setAddKeyTx(addKeyTx);
      } catch (e) {
        console.error("Error submitting message: ", e);
      }
    }
  };

  const isError = addKeyError !== null;

  const getButtonText = () => {
    // if (addKeySignPending) return 'Waiting for you to sign in your wallet'
    if (chainId !== optimismChainId) return "Switch to Optimism";
    if (isAddKeyTxLoading)
      return "Waiting for onchain transaction to be confirmed";
    if (isAddKeyTxSuccess) return "Confirmed onchain";
    // if (prepareToAddKeyError) return 'Failed to prepare onchain request'
    if (addKeyError) return "Failed to execute onchain request";
    return "Confirm account onchain";
  };

  return (
    <div className="flex flex-col gap-5">
      {!isWalletOwnerOfFid && (
        <Label className="font-semibold text-red-600">
          Connect a wallet that owns a Farcaster account.
        </Label>
      )}
      <Button
        variant="default"
        className="w-full"
        onClick={() => onClick()}
        disabled={!enabled || (isConnectedToOptimism && !isWalletOwnerOfFid) || isAddKeyTxSuccess || isError}
      >
        {getButtonText()}
        {isAddKeyTxLoading && (
          <Cog6ToothIcon
            className="ml-1.5 h-5 w-5 text-foreground/80 animate-spin"
            aria-hidden="true"
          />
        )}
        {isAddKeyTxSuccess && (
          <CheckCircleIcon
            className="ml-1.5 h-6 w-6 text-green-600"
            aria-hidden="true"
          />
        )}
      </Button>
      {!isAddKeyTxSuccess && <SwitchWalletButton />}
    </div>
  );
};

export default ConfirmOnchainSignerButton;

// todo:
// - fix
// - skip getSignerRequestStatus in warpcastQR code login when this isn't actually active
