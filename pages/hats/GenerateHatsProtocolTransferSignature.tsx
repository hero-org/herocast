import React, { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAccountModal, useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount, useSignTypedData } from "wagmi";
import { Input } from "@/components/ui/input";
import {
  ID_REGISTRY_EIP_712_DOMAIN,
  ID_REGISTRY_TRANSFER_TYPE,
  idRegistryABI,
} from "@farcaster/hub-web";
import { Cog6ToothIcon } from "@heroicons/react/20/solid";
import { ID_REGISTRY_ADDRESS } from "@farcaster/hub-web";
import { writeContract } from "@wagmi/core";
import { config, publicClient } from "@/common/helpers/rainbowkit";
import { encodePacked, keccak256, toHex } from "viem";
import { useWaitForTransactionReceipt } from "wagmi";
import { getDeadline } from "@/common/helpers/farcaster";
import { HatsFarcasterDelegatorAbi } from "@/common/constants/contracts/HatsFarcasterDelegator";

const readNonces = async (account: `0x${string}`) => {
  return await publicClient.readContract({
    address: ID_REGISTRY_ADDRESS,
    abi: idRegistryABI,
    functionName: "nonces",
    args: [account],
  });
};

enum GENERATE_SIGNATURE_STEPS_ENUM {
  "CONNECT_WALLET",
  "CALL_PREPARE_TO_RECEIVE",
  "GENERATE_SIGNATURE",
  "PENDING_SIGNATURE_CONFIRMATION",
  "EXECUTE_ONCHAIN",
  "PENDING_ONCHAIN_CONFIRMATION",
  "CONFIRMED",
  "ERROR",
}

type SignupStepType = {
  state: GENERATE_SIGNATURE_STEPS_ENUM;
  title: string;
  description: string;
  idx: number;
};

const HatsProtocolSignupSteps: SignupStepType[] = [
  {
    state: GENERATE_SIGNATURE_STEPS_ENUM.CONNECT_WALLET,
    title: "Connect your wallet",
    description:
      "Connect your wallet and use Farcaster with a Hats Protocol hat",
    idx: 0,
  },
  {
    state: GENERATE_SIGNATURE_STEPS_ENUM.CALL_PREPARE_TO_RECEIVE,
    title: "Prepare to receive",
    description:
      "Prepare your Hats Protocol Delegator contract instance to receive the Farcaster account",
    idx: 1,
  },
  {
    state: GENERATE_SIGNATURE_STEPS_ENUM.GENERATE_SIGNATURE,
    title: "Generate Signature",
    description:
      "Generate your signature for Farcaster account transfer to the Hats Protocol Delegator contract instance",
    idx: 2,
  },
  {
    state: GENERATE_SIGNATURE_STEPS_ENUM.PENDING_SIGNATURE_CONFIRMATION,
    title: "Pending confirmation",
    description: "Please confirm the signature in your wallet",
    idx: 3,
  },
  {
    state: GENERATE_SIGNATURE_STEPS_ENUM.EXECUTE_ONCHAIN,
    title: "Connected",
    description:
      "Signature generated, please execute the onchain transfer of your Farcaster account",
    idx: 4,
  },
  {
    state: GENERATE_SIGNATURE_STEPS_ENUM.PENDING_ONCHAIN_CONFIRMATION,
    title: "",
    description: "Pending onchain transfer",
    idx: 5,
  },
  {
    state: GENERATE_SIGNATURE_STEPS_ENUM.CONFIRMED,
    title: "",
    description: "You have successfully transferred your Farcaster account",
    idx: 6,
  },
  {
    state: GENERATE_SIGNATURE_STEPS_ENUM.ERROR,
    title: "Error",
    description: "Something went wrong",
    idx: 6,
  },
];

const GenerateHatsProtocolTransferSignature = ({
  fid,
  fromAddress,
  toAddress,
  onSuccess,
}: {
  fid: bigint;
  fromAddress: `0x${string}`;
  toAddress: `0x${string}`;
  onSuccess: () => null;
}) => {
  const [state, setState] = useState<SignupStepType>(
    HatsProtocolSignupSteps[0]
  );
  const [errorMessage, setErrorMessage] = useState("");
  // const [fromAddress, setFromAddress] = useState<`0x${string}`>("0x");
  // const [toAddress, setToAddress] = useState<`0x${string}`>("0x");
  // const [fid, setFid] = useState<bigint>(BigInt(0));
  const [signature, setSignature] = useState<`0x${string}`>("0x");
  const [deadline, setDeadline] = useState<bigint>(BigInt(0));
  const [nonce, setNonce] = useState<bigint>(BigInt(0));
  const [onchainTransactionHash, setOnchainTransactionHash] =
    useState<`0x${string}`>("0x");

  const { signTypedDataAsync } = useSignTypedData();

  const { address } = useAccount();

  const transactionResult = useWaitForTransactionReceipt({
    hash: onchainTransactionHash,
  });

  useEffect(() => {
    if (!fid) {
      setErrorMessage("FID is required");
      setState(HatsProtocolSignupSteps[6]);
    }

    if (!fromAddress) {
      setErrorMessage("From address is required");
      setState(HatsProtocolSignupSteps[6]);
    }

    if (!toAddress) {
      setErrorMessage("To address is required");
      setState(HatsProtocolSignupSteps[6]);
    }
  }, [fid, fromAddress, toAddress]);

  useEffect(() => {
    if (onchainTransactionHash === "0x") return;

    if (transactionResult) {
      setState(HatsProtocolSignupSteps[6]);
    }
  }, [onchainTransactionHash, transactionResult]);

  const onCallPrepareToReceive = async () => {
    // sleep
    setState(HatsProtocolSignupSteps[2]);
  };

  const onSignData = async () => {
    if (!address) return;

    const newNonce = await readNonces(address);
    setNonce(newNonce);
    const newDeadline = getDeadline();
    setDeadline(newDeadline);
    console.log(
      `fid: ${fid}, nonces: ${newNonce}, deadline: ${newDeadline} toAddress: ${toAddress}`
    );

    const typedData = {
      domain: ID_REGISTRY_EIP_712_DOMAIN,
      types: {
        Transfer: ID_REGISTRY_TRANSFER_TYPE,
      },
      primaryType: "Transfer" as const,
      message: {
        fid: BigInt(fid),
        to: toAddress,
        nonce: newNonce,
        deadline: BigInt(newDeadline),
      },
    };
    const newSignature = await signTypedDataAsync(typedData);
    console.log("newSignature", newSignature);
    if (!newSignature) {
      setErrorMessage("Error generating signature");
      setState(HatsProtocolSignupSteps[6]);
      return;
    }
    setSignature(newSignature);
    setState(HatsProtocolSignupSteps[3]);
  };

  const onExecuteTransfer = async () => {
    if (signature === "0x") return;

    const typeHash = keccak256(
      toHex("Transfer(uint256 fid,address to,uint256 nonce,uint256 deadline)")
    );
    const sig = encodePacked(
      ["bytes", "bytes32", "uint256", "address", "uint256", "uint256"],
      [signature, typeHash, BigInt(fid), toAddress, nonce, BigInt(deadline)]
    );

    const isFidOwnedByWallet = fromAddress === "0x";
    if (isFidOwnedByWallet) {
      const tx = await writeContract(config, {
        abi: idRegistryABI,
        address: ID_REGISTRY_ADDRESS,
        functionName: "transfer",
        args: [toAddress, BigInt(deadline), sig],
      });
      console.log("result", tx);
      setOnchainTransactionHash(tx);
      setState(HatsProtocolSignupSteps[5]);
    } else {
      const tx = await writeContract(config, {
        abi: HatsFarcasterDelegatorAbi,
        address: fromAddress,
        functionName: "transferFid",
        args: [toAddress, BigInt(deadline), sig],
      });
      console.log("result", tx);
      setOnchainTransactionHash(tx);
      setState(HatsProtocolSignupSteps[5]);
    }
  };

  const getButtonLabel = () => {
    switch (state.state) {
      case GENERATE_SIGNATURE_STEPS_ENUM.CONNECT_WALLET:
        return "Connect wallet";
      case GENERATE_SIGNATURE_STEPS_ENUM.CALL_PREPARE_TO_RECEIVE:
        return "Prepare for transfer";
      case GENERATE_SIGNATURE_STEPS_ENUM.GENERATE_SIGNATURE:
        return `Generate signature`;
      case GENERATE_SIGNATURE_STEPS_ENUM.PENDING_SIGNATURE_CONFIRMATION:
      case GENERATE_SIGNATURE_STEPS_ENUM.PENDING_ONCHAIN_CONFIRMATION:
        return (
          <p className="flex">
            <Cog6ToothIcon
              className="h-5 w-5 animate-spin"
              aria-hidden="true"
            />
          </p>
        );
      case GENERATE_SIGNATURE_STEPS_ENUM.EXECUTE_ONCHAIN:
        return "Execute onchain transfer";
      case GENERATE_SIGNATURE_STEPS_ENUM.CONFIRMED:
        return "Continue";
      case GENERATE_SIGNATURE_STEPS_ENUM.ERROR:
        return "Error";
    }
  };

  useEffect(() => {
    if (
      state.state === GENERATE_SIGNATURE_STEPS_ENUM.CONNECT_WALLET &&
      address
    ) {
      setState(HatsProtocolSignupSteps[1]);
    }
  }, [address]);

  const onClick = () => {
    if (errorMessage) return;

    switch (state.state) {
      case GENERATE_SIGNATURE_STEPS_ENUM.CALL_PREPARE_TO_RECEIVE:
        onCallPrepareToReceive();
        break;
      case GENERATE_SIGNATURE_STEPS_ENUM.GENERATE_SIGNATURE:
        if (!address) return;

        setState(HatsProtocolSignupSteps[4]);
        onSignData();
        break;
      case GENERATE_SIGNATURE_STEPS_ENUM.PENDING_SIGNATURE_CONFIRMATION:
        break;
      case GENERATE_SIGNATURE_STEPS_ENUM.EXECUTE_ONCHAIN:
        onExecuteTransfer();
        break;
      case GENERATE_SIGNATURE_STEPS_ENUM.PENDING_ONCHAIN_CONFIRMATION:
        break;
      case GENERATE_SIGNATURE_STEPS_ENUM.CONFIRMED:
        onSuccess();
        break;
      case GENERATE_SIGNATURE_STEPS_ENUM.ERROR:
        setState(HatsProtocolSignupSteps[0]);
        break;
      default:
          break;
    }
  };

  const getCardContent = () => {
    switch (state.state) {
      case GENERATE_SIGNATURE_STEPS_ENUM.CALL_PREPARE_TO_RECEIVE:
        return (
          <div className="flex flex-col">
            Prepare delegator contract to receive
          </div>
        );
      case GENERATE_SIGNATURE_STEPS_ENUM.GENERATE_SIGNATURE:
        return (
          <div className="flex flex-col">
            <div className="">
              {/* <p className="mb-1">What is the FID of the Farcaster account?</p>
              <Input
                className="w-2/3"
                placeholder="1"
                value={fid.toString()}
                onChange={(e) => setFid(BigInt(e.target.value))}
              /> */}
              {/* <p className="mt-4 mb-1">
                What is the address of the Hats Protocol Delegator instance?
                (leave empty if FID is owned by your current wallet)
              </p>
              <Input
                className="w-2/3"
                placeholder="0x"
                value={fromAddress}
                onChange={(e) =>
                  e.target.value.startsWith("0x")
                    ? setFromAddress(e.target.value as `0x${string}`)
                    : null
                }
              /> */}
              {/* <p className="mt-4 mb-1">
                What is the target Hats Protocol Delegator instance?
              </p>
              <Input
                className="w-2/3"
                placeholder="0x"
                value={toAddress}
                onChange={(e) =>
                  e.target.value.startsWith("0x")
                    ? setToAddress(e.target.value as `0x${string}`)
                    : null
                }
              /> */}
            </div>
          </div>
        );
      case GENERATE_SIGNATURE_STEPS_ENUM.EXECUTE_ONCHAIN:
      case GENERATE_SIGNATURE_STEPS_ENUM.CONFIRMED:
        return (
          <div className="flex flex-col">
            <div className="w-2/3">
              <p className="">Signature:</p>
              <p className="p-2 rounded-md bg-gray-200 text-gray-700 text-wrap break-all">
                {signature}
              </p>
            </div>
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
      <Button className="w-1/2" variant="default" disabled={!!errorMessage}onClick={() => onClick()}>
        {getButtonLabel()}
      </Button>
    </div>
  );
};

export default GenerateHatsProtocolTransferSignature;
