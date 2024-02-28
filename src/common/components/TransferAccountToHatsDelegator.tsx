import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAccount, useReadContract, useSignTypedData } from "wagmi";
import {
  ID_REGISTRY_EIP_712_DOMAIN,
  ID_REGISTRY_TRANSFER_TYPE,
  idRegistryABI,
} from "@farcaster/hub-web";
import { Cog6ToothIcon } from "@heroicons/react/20/solid";
import { ID_REGISTRY_ADDRESS } from "@farcaster/hub-web";
import { writeContract } from "@wagmi/core";
import { config, publicClient } from "@/common/helpers/rainbowkit";
import { encodePacked, hashTypedData, keccak256, toHex } from "viem";
import { useWaitForTransactionReceipt } from "wagmi";
import { getDeadline } from "@/common/helpers/farcaster";
import { HatsFarcasterDelegatorAbi } from "@/common/constants/contracts/HatsFarcasterDelegator";
import { openWindow } from "../helpers/navigation";
import {
  SIGNED_KEY_REQUEST_TYPEHASH,
  isValidSignature,
  isValidSigner,
} from "@/lib/hats";
import { waitForTransactionReceipt } from "@wagmi/core";

const readNonces = async (account: `0x${string}`) => {
  return await publicClient.readContract({
    address: ID_REGISTRY_ADDRESS,
    abi: idRegistryABI,
    functionName: "nonces",
    args: [account],
  });
};

enum TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS {
  "CONNECT_WALLET",
  "EXECUTE_PREPARE_TO_RECEIVE",
  "PENDING_PREPARE_TO_RECEIVE_CONFIRMATION",
  "GENERATE_SIGNATURE",
  "PENDING_SIGNATURE_CONFIRMATION",
  "EXECUTE_ONCHAIN",
  "PENDING_ONCHAIN_CONFIRMATION",
  "CONFIRMED",
  "ERROR",
}

type TransferAccountToHatsDelegatorStepType = {
  state: TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS;
  title: string;
  description: string;
  idx: number;
};

const TransferAccountToHatsDelegatorSteps: TransferAccountToHatsDelegatorStepType[] =
  [
    {
      state: TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.CONNECT_WALLET,
      title: "Connect your wallet",
      description:
        "Connect your wallet and use Farcaster with a Hats Protocol hat",
      idx: 0,
    },
    {
      state:
        TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.EXECUTE_PREPARE_TO_RECEIVE,
      title: "Prepare to receive",
      description:
        "Prepare your Hats Protocol Delegator contract instance to receive the Farcaster account",
      idx: 1,
    },
    {
      state:
        TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.PENDING_PREPARE_TO_RECEIVE_CONFIRMATION,
      title: "Pending confirmation",
      description:
        "Waiting for confirmation that the contract is ready to receive your Farcaster account",
      idx: 2,
    },
    {
      state: TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.GENERATE_SIGNATURE,
      title: "Generate Signature",
      description:
        "Generate your signature for Farcaster account transfer to the Hats Protocol Delegator contract instance",
      idx: 3,
    },
    {
      state:
        TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.PENDING_SIGNATURE_CONFIRMATION,
      title: "Pending confirmation",
      description: "Please confirm the signature in your wallet",
      idx: 4,
    },
    {
      state: TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.EXECUTE_ONCHAIN,
      title: "Connected",
      description:
        "Signature generated, please execute the onchain transfer of your Farcaster account",
      idx: 5,
    },
    {
      state:
        TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.PENDING_ONCHAIN_CONFIRMATION,
      title: "",
      description: "Pending onchain transfer",
      idx: 6,
    },
    {
      state: TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.CONFIRMED,
      title: "",
      description: "You have successfully transferred your Farcaster account",
      idx: 7,
    },
    {
      state: TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.ERROR,
      title: "Error",
      description: "Something went wrong",
      idx: 8,
    },
  ];

const TransferAccountToHatsDelegator = ({
  fid,
  fromAddress,
  toAddress,
  onSuccess,
}: {
  fid: bigint;
  fromAddress: `0x${string}`;
  toAddress: `0x${string}`;
  onSuccess: () => void;
}) => {
  const [step, setStep] = useState<TransferAccountToHatsDelegatorStepType>(
    TransferAccountToHatsDelegatorSteps[0]
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [signature, setSignature] = useState<`0x${string}`>("0x");
  const [deadline, setDeadline] = useState<bigint>(BigInt(0));
  const [nonce, setNonce] = useState<bigint>(BigInt(0));
  const [onchainTransactionHash, setOnchainTransactionHash] =
    useState<`0x${string}`>(
      "0x"
      // "0xa040548f222ec0dfeab4b846359aa6f79368a36060defd2624f1d177d5628ef2"
    );

  const { signTypedDataAsync } = useSignTypedData();

  const { address } = useAccount();

  const transactionResult = useWaitForTransactionReceipt({
    hash: onchainTransactionHash,
  });

  const {
    data: isFidReceivable,
    error,
    status,
  } = useReadContract({
    address: toAddress,
    abi: HatsFarcasterDelegatorAbi,
    chainId: 10,
    functionName: toAddress && fid ? "receivable" : undefined,
    args: toAddress && fid ? [fid] : undefined,
  });

  useEffect(() => {
    if (step.state === TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.EXECUTE_PREPARE_TO_RECEIVE && isFidReceivable) {
      setStepToKey(TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.GENERATE_SIGNATURE);
    }
  }, [isFidReceivable, status, step]);

  const setStepToKey = (key: TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS) => {
    const newStep = TransferAccountToHatsDelegatorSteps.find(
      (step) => step.state === key
    );
    if (newStep) setStep(newStep);
  };

  useEffect(() => {
    if (!fid) {
      setErrorMessage("FID is required");
      setStepToKey(TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.ERROR);
    }

    if (!fromAddress) {
      setErrorMessage("From address is required");
      setStepToKey(TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.ERROR);
    }

    if (!toAddress) {
      setErrorMessage("To address is required");
      setStepToKey(TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.ERROR);
    }

    const setup = async () => {
      const newNonce = await readNonces(toAddress); // or address?
      setNonce(newNonce);
      const newDeadline = getDeadline();
      setDeadline(newDeadline);
      console.log(
        `setup done, fid: ${fid}, nonces: ${newNonce}, deadline: ${newDeadline} toAddress: ${toAddress}`
      );
    }

    setup();
  }, [fid, fromAddress, toAddress]);

  useEffect(() => {
    if (onchainTransactionHash === "0x") return;

    if (transactionResult) {
      console.log("transactionResult", transactionResult?.data);
      setStepToKey(TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.CONFIRMED);
    }
  }, [onchainTransactionHash, transactionResult]);

  const onExecutePrepareToReceive = async () => {
    try {
      const tx = await writeContract(config, {
        abi: HatsFarcasterDelegatorAbi,
        address: toAddress,
        functionName: "prepareToReceive",
        args: [fid],
      });

      const result = await waitForTransactionReceipt(config, { hash: tx });
      console.log("result", result);
      setStep(TransferAccountToHatsDelegatorSteps[2]);
      setStepToKey(
        TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.PENDING_PREPARE_TO_RECEIVE_CONFIRMATION
      );
    } catch (e) {
      console.error("onExecutePrepareToReceive error", e);
      setErrorMessage(e?.message || e);
      setStepToKey(TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.ERROR);
    }
  };

  const getTransferTypeData = () => ({
    domain: ID_REGISTRY_EIP_712_DOMAIN,
    types: {
      Transfer: ID_REGISTRY_TRANSFER_TYPE,
    },
    primaryType: "Transfer" as const,
    message: {
      fid,
      to: toAddress,
      nonce: nonce,
      deadline: BigInt(deadline),
    },
  });

  const onSignData = async () => {
    if (!address) return;

    const hasConnectedValidSignerAddress = await isValidSigner(
      toAddress!,
      SIGNED_KEY_REQUEST_TYPEHASH,
      address
    );

    if (!hasConnectedValidSignerAddress) {
      setErrorMessage(
        "Your wallet isn't allowed to sign messages for the delegator contract - please use a different wallet that is wearing the Admin Hat"
      );
      setStepToKey(TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.ERROR);
      return;
    }

    const typedData = getTransferTypeData();
    const newSignature = await signTypedDataAsync(typedData);
    if (!newSignature) {
      setErrorMessage("Error generating signature");
      setStepToKey(TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.ERROR);
      return;
    }

    setSignature(newSignature);
    setStepToKey(TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.EXECUTE_ONCHAIN);
  };

  const onExecuteTransfer = async () => {
    if (!address || signature === "0x") return;

    const typeHash = keccak256(
      toHex("Transfer(uint256 fid,address to,uint256 nonce,uint256 deadline)")
    );
    const sig = encodePacked(
      ["bytes", "bytes32", "uint256", "address", "uint256", "uint256"],
      [signature, typeHash, BigInt(fid), toAddress, nonce, BigInt(deadline)]
    );
    
    try {
      const hash = hashTypedData(getTransferTypeData());
      const isValidSig = await isValidSignature(toAddress, hash, sig);
      console.log("isValidSig", isValidSig);
    } catch (e) {
      console.log('failed something', e);
      setErrorMessage(`Error validating signature: ${e}`);
      setStepToKey(TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.ERROR);
    }

    const isFidOwnedByWallet = fromAddress === address;
    console.log("isFidOwnedByWallet", isFidOwnedByWallet);
    try {
      if (isFidOwnedByWallet) {
        const tx = await writeContract(config, {
          abi: idRegistryABI,
          address: ID_REGISTRY_ADDRESS,
          functionName: "transfer",
          args: [toAddress, BigInt(deadline), sig],
        });
        console.log("result", tx);
        setOnchainTransactionHash(tx);
      } else {
        const tx = await writeContract(config, {
          abi: HatsFarcasterDelegatorAbi,
          address: fromAddress,
          functionName: "transferFid",
          args: [toAddress, BigInt(deadline), sig],
        });
        console.log("result", tx);
        setOnchainTransactionHash(tx);
      }
      setStepToKey(
        TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.PENDING_ONCHAIN_CONFIRMATION
      );
    } catch (e) {
      if ('User rejected the request' in e) {
        setErrorMessage('User rejected the request');
      } else {
        setErrorMessage(e?.message || e);
      }
      setStepToKey(TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.ERROR);
    }
  };

  const getButtonLabel = () => {
    switch (step.state) {
      case TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.CONNECT_WALLET:
        return "Connect wallet";
      case TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.EXECUTE_PREPARE_TO_RECEIVE:
        return "Prepare for transfer";
      case TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.GENERATE_SIGNATURE:
        return `Generate signature`;
      case TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.PENDING_SIGNATURE_CONFIRMATION:
      case TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.PENDING_ONCHAIN_CONFIRMATION:
        return (
          <p className="flex text-muted-foreground">
            <Cog6ToothIcon
              className="h-5 w-5 animate-spin"
              aria-hidden="true"
            />
          </p>
        );
      case TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.EXECUTE_ONCHAIN:
        return "Execute onchain transfer";
      case TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.CONFIRMED:
        return "Continue";
      case TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.ERROR:
        return "Error";
    }
  };

  useEffect(() => {
    if (
      step.state === TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.CONNECT_WALLET &&
      address
    ) {
      setStep(TransferAccountToHatsDelegatorSteps[1]);
    }
  }, [address]);

  const onClick = () => {
    if (errorMessage) return;

    switch (step.state) {
      case TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.EXECUTE_PREPARE_TO_RECEIVE:
        onExecutePrepareToReceive();
        break;
      case TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.GENERATE_SIGNATURE:
        if (!address) return;

        setStepToKey(
          TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.PENDING_SIGNATURE_CONFIRMATION
        );
        onSignData();
        break;
      case TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.PENDING_SIGNATURE_CONFIRMATION:
        break;
      case TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.EXECUTE_ONCHAIN:
        onExecuteTransfer();
        break;
      case TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.PENDING_ONCHAIN_CONFIRMATION:
        break;
      case TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.CONFIRMED:
        onSuccess();
        break;
      case TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.ERROR:
        setStepToKey(TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.CONNECT_WALLET);
        break;
      default:
        break;
    }
  };

  const getCardContent = () => {
    switch (step.state) {
      case TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.EXECUTE_PREPARE_TO_RECEIVE:
        return (
          <div className="flex flex-col">
            Prepare delegator contract {toAddress} to receive your Farcaster
            account with FID {fid.toString()}
          </div>
        );
      case TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.GENERATE_SIGNATURE:
      case TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.EXECUTE_ONCHAIN:
      case TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.PENDING_SIGNATURE_CONFIRMATION:
        return (
          <div className="flex flex-col">
            <div>
              <p>
                Transferring your Farcaster account with FID {fid.toString()} to
                delegator contract {toAddress}.
              </p>
              <p className="text-muted-foreground">
                This requires a signature and one onchain transaction.
              </p>
            </div>
            {/* {signature !== "0x" && (
              <div className="mt-4 w-2/3">
                <p className="">Transfer signature</p>
                <p className="truncate p-2 rounded-md bg-gray-200 text-gray-700 text-wrap break-all">
                  {signature}
                </p>
              </div>
            )} */}
          </div>
        );
      case TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.CONFIRMED:
        return (
          <div className="flex flex-col text-foreground">
            <p>
              Your account was successfully transferred to the delegator
              contract 🥳
            </p>
            <Button
              variant="outline"
              className="w-1/2 mt-4"
              onClick={() =>
                openWindow(
                  `https://optimistic.etherscan.io/tx/${onchainTransactionHash}`
                )
              }
            >
              See transaction on Etherscan ↗️
            </Button>
          </div>
        );
      default:
        return <></>;
    }
  };

  return (
    <div className="flex flex-col w-2/3 space-y-4">
      {getCardContent()}
      {errorMessage && (
        <div className="flex flex-start items-center mt-2">
          <p className="text-wrap break-all	text-sm text-red-500">
            Error: {errorMessage}
          </p>
        </div>
      )}
      <Button
        className="w-1/2"
        variant="default"
        disabled={
          !!errorMessage ||
          !toAddress ||
          !fromAddress ||
          !fid ||
          !address ||
          step.state ===
            TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.PENDING_SIGNATURE_CONFIRMATION ||
          step.state ===
            TRANSFER_ACCOUNT_TO_HATS_DELEGATOR_STEPS.PENDING_ONCHAIN_CONFIRMATION
        }
        onClick={() => onClick()}
      >
        {getButtonLabel()}
      </Button>
    </div>
  );
};

export default TransferAccountToHatsDelegator;
