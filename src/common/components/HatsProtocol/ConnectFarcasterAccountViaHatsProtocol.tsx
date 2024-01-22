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
import { readContract } from "@wagmi/core";
import { Input } from "@/components/ui/input";
import {
  HatsFarcasterDelegatorAbi,
  HatsFarcasterDelegatorContractAddress,
} from "@/common/constants/contracts/HatsFarcasterDelegator";
import {
  WalletClient,
  createWalletClient,
  custom,
  encodePacked,
  hashTypedData,
  keccak256,
  toHex,
} from "viem";
import {
  SIGNED_KEY_REQUEST_TYPE,
  SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
  ViemWalletEip712Signer,
} from "@farcaster/hub-web";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { Cog6ToothIcon } from "@heroicons/react/20/solid";
import { config, wagmiConfig } from "@/common/helpers/rainbowkit";
import { publishCastWithLocalWallet } from "@/common/helpers/farcaster";
import {
  formatPlaintextToHubCastMessage,
} from '@mod-protocol/farcaster';
import { getWalletClient, getConnectorClient } from '@wagmi/core';

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
    description:
      "Connect your wallet and use Farcaster with a Hats Protocol hat",
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
  const [errorMessage, setErrorMessage] = useState("");
  const [accountName, setAccountName] = useState("herocast-test");

  const { address, status, connector } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();
  const { signTypedDataAsync } = useSignTypedData();
  
  const deadline = Math.floor(Date.now() / 1000) + 86400; // signature is valid for 1 day

  const onSignData = async () => {
    if (!address) return;

    const neynarClient = new NeynarAPIClient(
      process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
    );

    let fid: number | undefined;
    try {
      const resp = await neynarClient.lookupUserByUsername(
        accountName,
        parseInt(APP_FID)
      );
      fid = resp.result.user?.fid;
    } catch (err) {
      console.log(
        "ConnectFarcasterAccountViaHatsProtocol: error getting data",
        err
      );
    }
    if (!fid) {
      setErrorMessage(`User ${accountName} not found`);
      return;
    }

    const key = toHex(address);
    const typedData = {
      domain: SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
      types: {
        SignedKeyRequest: SIGNED_KEY_REQUEST_TYPE,
      },
      primaryType: "SignedKeyRequest" as const,
      message: {
        requestFid: BigInt(fid),
        key: key,
        deadline: BigInt(deadline),
      },
    };
    const hash = hashTypedData(typedData);
    const newSignature = await signTypedDataAsync(typedData);
    const typeHash = keccak256(
      toHex("SignedKeyRequest(uint256 requestFid,bytes key,uint256 deadline)")
    );

    const sig = encodePacked(
      ["bytes", "bytes32", "uint256", "bytes", "uint256"],
      [newSignature, typeHash, BigInt(fid), keccak256(key), BigInt(deadline)]
    );

    const result = await readContract(config, {
      address: HatsFarcasterDelegatorContractAddress,
      abi: HatsFarcasterDelegatorAbi,
      functionName: "isValidSignature",
      args: [hash, sig],
    });

    console.log("readContract result", result);

    if (result === "0x1626ba7e") {
      setState(HatsProtocolSignupSteps[3]);
      // do a little test cast when this works
      const castBody = await formatPlaintextToHubCastMessage({
        text: "this is a little test cast",
        embeds: [],
        getMentionFidsByUsernames: async () => [],
      });

      if (!castBody) {
        console.log("ConnectFarcasterAccountViaHatsProtocol: error formatting cast body");
        return;
      }

      const client = await getWalletClient(config, {
        account: address
      });
      const wallet = new ViemWalletEip712Signer(client);
      publishCastWithLocalWallet({authorFid: fid.toString(), wallet, castBody});

    } else {
      setState(HatsProtocolSignupSteps[4]);
    }
  };

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
    if (state.state === SignupStateEnum.CONNECT_WALLET && address) {
      setState(HatsProtocolSignupSteps[1]);
    }
  }, [address]);

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
