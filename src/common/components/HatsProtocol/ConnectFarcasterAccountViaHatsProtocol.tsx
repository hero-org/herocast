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
import { useAccount, useReadContract, useSignTypedData } from "wagmi";
import { Input } from "@/components/ui/input";
import {
  HatsFarcasterDelegatorAbi,
  HatsFarcasterDelegatorContractAddress,
} from "@/common/constants/contracts/HatsFarcasterDelegator";
import { encodeAbiParameters } from "viem";
import {
  SIGNED_KEY_REQUEST_TYPE,
  SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
} from "@farcaster/hub-web";
import { mnemonicToAccount } from "viem/accounts";
import { C } from "node_modules/@tauri-apps/api/shell-efff51a2";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import {
  Cog6ToothIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/20/solid";

enum SignupStateEnum {
  "CONNECT_WALLET",
  "SELECT_FARCASTER_ACCOUNT",
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "ERROR",
}

type SignupStepType = {
  state: SignupStateEnum;
  title: string;
  description: string;
  idx: number;
};

const HatsProtocolSignupSteps: SignupStepType[] = [
  {
    state: SignupStateEnum.CONNECT_WALLET,
    title: "Connect your wallet",
    description: "Connect your wallet and use Farcaster with a Hats Protocol hat",
    idx: 0,
  },
  {
    state: SignupStateEnum.SELECT_FARCASTER_ACCOUNT,
    title: "Select Farcaster account",
    description: "Select the Farcaster account you want to connect",
    idx: 1,
  },
  {
    state: SignupStateEnum.PENDING_CONFIRMATION,
    title: "Confirming your access to the Farcaster account",
    description: "",
    idx: 2,
  },
  {
    state: SignupStateEnum.CONFIRMED,
    title: "Connected",
    description: "You have successfully connected your Farcaster account",
    idx: 3,
  },
  {
    state: SignupStateEnum.ERROR,
    title: "Error",
    description: "Something went wrong",
    idx: 4,
  },
];

const APP_FID = process.env.NEXT_PUBLIC_APP_FID!;

const ConnectFarcasterAccountViaHatsProtocol = () => {
  const [state, setState] = useState<SignupStepType>(
    HatsProtocolSignupSteps[0]
  );
  const [signature, setSignature] = useState<`0x${string}`>("0x");
  const [errorMessage, setErrorMessage] = useState("");
  const [accountName, setAccountName] = useState("");

  const { address, status } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();
  const { signTypedDataAsync } = useSignTypedData();

  const deadline = Math.floor(Date.now() / 1000) + 86400; // signature is valid for 1 day

  const onSignData = async () => {
    const neynarClient = new NeynarAPIClient(
      process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
    );

    let requestFid: number | undefined;
    try {
      const resp = await neynarClient.lookupUserByUsername(
        accountName,
        parseInt(APP_FID)
      );
      console.log("got user result", resp.result.user);
      requestFid = resp.result.user?.fid;
    } catch (err) {
      console.log(
        "ConnectFarcasterAccountViaHatsProtocol: error getting data",
        err
      );
    }
    if (!requestFid) {
      setErrorMessage(`User ${accountName} not found`);
      return;
    }

    const newSignature = await signTypedDataAsync({
      types: {
        SignedKeyRequest: SIGNED_KEY_REQUEST_TYPE,
      },
      primaryType: "SignedKeyRequest",
      message: {
        requestFid: BigInt(requestFid),
        key: address as `0x${string}`,
        deadline: BigInt(deadline),
      },
    });

    console.log("signTypedDataAsync signature", newSignature);
    setSignature(newSignature);
  };

  const canRead = address && signature !== "0x";
  const {
    data: readDelegatorContractData,
    status: readDelegatorContractStatus,
    error: readDelegatorContractError,
  } = useReadContract({
    address: HatsFarcasterDelegatorContractAddress,
    abi: HatsFarcasterDelegatorAbi,
    functionName: canRead ? "isValidSignature" : undefined,
    args: canRead ? [signature, address] : undefined,
  });

  console.log(
    "readDelegatorContractData",
    readDelegatorContractData,
    "readDelegatorContractStatus",
    readDelegatorContractStatus,
    "readDelegatorContractError",
    readDelegatorContractError
  );

  useEffect(() => {
    if (readDelegatorContractError) {
      setErrorMessage(readDelegatorContractError.message);
    }
  }, [readDelegatorContractError]);

  const getButtonLabel = () => {
    switch (state.state) {
      case SignupStateEnum.CONNECT_WALLET:
        return "Connect wallet";
      case SignupStateEnum.SELECT_FARCASTER_ACCOUNT:
        return `Connect to ${accountName || "Farcaster account"}`;
      case SignupStateEnum.PENDING_CONFIRMATION:
        return (
          <p className="flex">
            <Cog6ToothIcon
              className="h-5 w-5 text-gray-500 animate-spin"
              aria-hidden="true"
            />
          </p>
        );
      case SignupStateEnum.CONFIRMED:
        return "Connected";
      case SignupStateEnum.ERROR:
        return "Error";
    }
  };

  useEffect(() => {
    console.log("address", address, "status", status);
    if (state.state === SignupStateEnum.CONNECT_WALLET && address) {
      setState(HatsProtocolSignupSteps[1]);
    }
  }, [address]);

  // TODO:
  // - sign request so that Farcaster
  // - check with HatsProtocol if the account is valid
  // - if yes, create account with type hats_protocol and set state to CONFIRMED
  // - if no, set state to ERROR and show error message
  const onClick = () => {
    switch (state.state) {
      case SignupStateEnum.CONNECT_WALLET:
        openConnectModal?.();
        break;
      case SignupStateEnum.SELECT_FARCASTER_ACCOUNT:
        if (!address) return;

        setState(HatsProtocolSignupSteps[2]);
        onSignData();
        break;
      case SignupStateEnum.PENDING_CONFIRMATION:
        // setState(HatsProtocolSignupSteps[3]);
        break;
      case SignupStateEnum.CONFIRMED:
        setState(HatsProtocolSignupSteps[4]);
        break;
      case SignupStateEnum.ERROR:
        setState(HatsProtocolSignupSteps[0]);
        break;
    }
  };

  const getCardContent = () => {
    switch (state.state) {
      case SignupStateEnum.SELECT_FARCASTER_ACCOUNT:
        return (
          <div className="flex flex-col">
            <div className="w-2/3">
              <p className="">Which account do you want to connect?</p>
              <Input
                placeholder="herocast"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
              />
            </div>
          </div>
        );
      case SignupStateEnum.PENDING_CONFIRMATION:
        return (
          <div className="flex flex-col">
            <div className="w-full">
              <p className="">
                Confirming your access to the {accountName} Farcaster account.
                <br />
                Looking up your hat with HatsProtocol and Farcaster.
              </p>
            </div>
          </div>
        );

      default:
        return <></>;
    }
  };

  return (
    <div className="flex w-full max-w-xl">
      <Card className="bg-background text-foreground">
        <CardHeader>
          <CardTitle className="text-2xl">
            Connect your Farcaster Account with Hats Protocol 🧢 (beta)
          </CardTitle>
          <CardDescription className="text-lg">
            {state.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="w-full max-w-lg">
          {getCardContent()}
          {errorMessage && (
            <div className="flex flex-start items-center mt-2">
              <p className="text-wrap break-all	text-sm text-red-500">
                Error: {errorMessage}
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button
            className="w-full"
            variant="default"
            disabled={state.state === SignupStateEnum.PENDING_CONFIRMATION}
            onClick={() => onClick()}
          >
            {getButtonLabel()}
          </Button>
          {state.state === SignupStateEnum.SELECT_FARCASTER_ACCOUNT && (
            <Button
              className="ml-4 w-full"
              variant="outline"
              onClick={() =>
                address ? openAccountModal?.() : openConnectModal?.()
              }
            >
              Switch your connected wallet
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default ConnectFarcasterAccountViaHatsProtocol;