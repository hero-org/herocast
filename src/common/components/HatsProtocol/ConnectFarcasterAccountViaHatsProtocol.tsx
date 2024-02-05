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
import {
  useAccount,
  useSignTypedData,
  useWaitForTransactionReceipt,
} from "wagmi";
import { readContract } from "@wagmi/core";
import { Input } from "@/components/ui/input";
import {
  HatsFarcasterDelegatorAbi,
} from "@/common/constants/contracts/HatsFarcasterDelegator";
import {
  encodeAbiParameters,
  encodePacked,
  hashTypedData,
  keccak256,
  toHex,
} from "viem";
import {
  KEY_GATEWAY_ADDRESS,
  SIGNED_KEY_REQUEST_TYPE,
  SIGNED_KEY_REQUEST_VALIDATOR_ADDRESS,
  SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
  bytesToHexString,
  keyGatewayABI,
  signedKeyRequestValidatorABI,
} from "@farcaster/hub-web";
import { Cog6ToothIcon } from "@heroicons/react/20/solid";
import { config, publicClient } from "@/common/helpers/rainbowkit";
import {
  getDeadline,
} from "@/common/helpers/farcaster";
import { writeContract } from "@wagmi/core";
import { generateKeyPair } from "@/common/helpers/warpcastLogin";
import {
  AccountPlatformType,
  AccountStatusType,
} from "@/common/constants/accounts";
import { useAccountStore } from "@/stores/useAccountStore";
import { JoinedHerocastViaHatsProtocolDraft, useNewPostStore } from "@/stores/useNewPostStore";
import { useRouter } from "next/router";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";

enum SignupStateEnum {
  "CONNECT_WALLET",
  "SELECT_FARCASTER_ACCOUNT",
  "CHECKING_IS_VALID_SIGNER",
  "CONFIRMED_IS_VALID_SIGNER",
  "PENDING_ADD_KEY",
  "CONFIRMED_ADD_KEY",
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
    state: SignupStateEnum.CHECKING_IS_VALID_SIGNER,
    title: "Confirming your access to the Farcaster account",
    description: "",
    idx: 2,
  },
  {
    state: SignupStateEnum.PENDING_ADD_KEY,
    title: "",
    description: "Add your herocast signer to Hats Protocol to start casting",
    idx: 3,
  },
  {
    state: SignupStateEnum.CONFIRMED_ADD_KEY,
    title: "",
    description: "You have successfully connected your Farcaster account",
    idx: 4,
  },
  {
    state: SignupStateEnum.ERROR,
    title: "Error",
    description: "Something went wrong",
    idx: 5,
  },
];

const readNoncesFromKeyGateway = async (account: `0x${string}`) => {
  return await publicClient.readContract({
    abi: keyGatewayABI,
    address: KEY_GATEWAY_ADDRESS,
    functionName: "nonces",
    args: [account],
  });
};

async function isValidSignedKeyRequest(
  fid: bigint,
  key: `0x${string}`,
  signedKeyRequest: `0x${string}`
): Promise<boolean> {
  const res = await readContract(config, {
    address: SIGNED_KEY_REQUEST_VALIDATOR_ADDRESS,
    abi: signedKeyRequestValidatorABI,
    functionName: "validate",
    args: [fid, key, signedKeyRequest],
  });
  console.log("isValidSignedKeyRequest result", res);
  return res;
}

async function isValidSignature(
  hash: `0x${string}`,
  sig: `0x${string}`
): Promise<boolean> {
  const HatsFarcasterDelegatorContractAddress =
    "0x2564F40382aEDb5dd849E792911B28AaE52a4ACf" as `0x${string}`;
  const res = await readContract(config, {
    address: HatsFarcasterDelegatorContractAddress,
    abi: HatsFarcasterDelegatorAbi,
    functionName: "isValidSignature",
    args: [hash, sig],
  });
  console.log(
    "isValidSignature result",
    res,
    "isValid: ",
    res === "0x1626ba7e"
  );
  return res === "0x1626ba7e";
}

const APP_FID = process.env.NEXT_PUBLIC_APP_FID!;

const ConnectFarcasterAccountViaHatsProtocol = () => {
  const router = useRouter();

  const [state, setState] = useState<SignupStepType>(
    HatsProtocolSignupSteps[0]
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [accountName, setAccountName] = useState("");
  const [deadline, setDeadline] = useState<bigint>(BigInt(0));
  const [delegatorContractAddress, setDelegatorContractAddress] = useState<`0x${string}`>("0x");
  const [fid, setFid] = useState<bigint>(BigInt(0));
  const [onchainTransactionHash, setOnchainTransactionHash] =
    useState<`0x${string}`>("0x");

  const {
    addNewPostDraft,
  } = useNewPostStore();
  

  const { address, status, connector } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();
  const { signTypedDataAsync } = useSignTypedData();

  const { accounts, addAccount, setAccountActive } = useAccountStore();
  const hatsProtocolPendingAccounts = accounts.filter(
    (account) =>
      account.status === AccountStatusType.pending &&
      account.platform === AccountPlatformType.farcaster_hats_protocol
  );

  const getFidForUsername = async (username: string) => {
    const neynarClient = new NeynarAPIClient(
      process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
    );
    try {
      const resp = await neynarClient.lookupUserByUsername(
        accountName,
        parseInt(APP_FID)
      );
      return resp.result.user?.fid;
    } catch (err) {
      console.log(
        "ConnectFarcasterAccountViaHatsProtocol: error getting data",
        err
      );
    }
  }

  const onSignData = async () => {
    if (!address) return;
    setState(HatsProtocolSignupSteps[2]);

    let fid: number | undefined;
    const isNumeric = /^-?\d+$/.test(accountName);
    if (isNumeric) {
      fid = parseInt(accountName);
    } else {
      fid = await getFidForUsername(accountName);
    }
    
    if (!fid) {
      setErrorMessage(`User ${accountName} not found`);
      return;
    }
    
    const newDeadline = BigInt(getDeadline());
    setDeadline(newDeadline);
    setState(HatsProtocolSignupSteps[3]);
  };

  const onAddHerocastSignerToHatsProtocol = async () => {
    if (!address) return;

    let hexStringPublicKey: `0x${string}`, hexStringPrivateKey: `0x${string}`;
    if (
      !hatsProtocolPendingAccounts ||
      hatsProtocolPendingAccounts.length === 0
    ) {
      const { publicKey, privateKey } = await generateKeyPair();
      hexStringPublicKey = bytesToHexString(publicKey)._unsafeUnwrap();
      hexStringPrivateKey = bytesToHexString(privateKey)._unsafeUnwrap();

      try {
        addAccount({
          id: null,
          platformAccountId: fid.toString(),
          status: AccountStatusType.pending,
          platform: AccountPlatformType.farcaster_hats_protocol,
          publicKey: hexStringPublicKey,
          privateKey: hexStringPrivateKey,
          data: {},
        });
      } catch (e) {
        console.log("error when trying to add account", e);
        setState(HatsProtocolSignupSteps[5]);
        return;
      }
    } else {
      hexStringPublicKey = hatsProtocolPendingAccounts[0].publicKey;
      hexStringPrivateKey = hatsProtocolPendingAccounts[0].privateKey!;
    }

    const nonce = await readNoncesFromKeyGateway(delegatorContractAddress);
    const typedMetadataData = {
      domain: SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
      types: {
        SignedKeyRequest: SIGNED_KEY_REQUEST_TYPE,
      },
      primaryType: "SignedKeyRequest" as const,
      message: {
        requestFid: BigInt(fid),
        key: hexStringPublicKey,
        deadline: BigInt(deadline),
      },
    };
    const metadataHash = hashTypedData(typedMetadataData);
    const metadataSignature = await signTypedDataAsync(typedMetadataData);

    const METADATA_TYPEHASH =
      "0x16be47f1f1f50a66a48db64eba3fd35c21439c23622e513aab5b902018aec438";

    const hatsProtocolSignature = encodePacked(
      ["bytes", "bytes32", "uint256", "bytes", "uint256"],
      [
        metadataSignature,
        METADATA_TYPEHASH,
        BigInt(fid),
        keccak256(hexStringPublicKey),
        deadline,
      ]
    );

    const metadata = encodeAbiParameters(
      [
        {
          components: [
            {
              name: "requestFid",
              type: "uint256",
            },
            {
              name: "requestSigner",
              type: "address",
            },
            {
              name: "signature",
              type: "bytes",
            },
            {
              name: "deadline",
              type: "uint256",
            },
          ],
          type: "tuple",
        },
      ],
      [
        {
          requestFid: BigInt(fid), // BigInt(APP_FID!),
          requestSigner: delegatorContractAddress, // appAccount.address,
          signature: hatsProtocolSignature,
          deadline,
        },
      ]
    );
    console.log('isMetadataSignatureValid', await isValidSignature(metadataHash, metadata));
    const isValidSignedKeyReq = isValidSignedKeyRequest(
      BigInt(fid),
      hexStringPublicKey,
      metadata
    );

    const tx = await writeContract(config, {
      abi: HatsFarcasterDelegatorAbi,
      address: delegatorContractAddress,
      functionName: "addKey",
      args: [1, hexStringPublicKey, 1, metadata],
    });

    console.log("result tx", tx);
    setOnchainTransactionHash(tx);
  };

  const transactionResult = useWaitForTransactionReceipt({
    hash: onchainTransactionHash,
  });

  useEffect(() => {
    if (onchainTransactionHash === "0x") return;

    if (transactionResult && hatsProtocolPendingAccounts.length > 0) {
      setState(HatsProtocolSignupSteps[4]);
      setAccountActive(hatsProtocolPendingAccounts[0].id!, "", {
        platform_account_id: fid.toString(),
        data: {},
      });
    }
  }, [onchainTransactionHash, transactionResult]);

  const onPublishTestCast = async () => {
    addNewPostDraft(JoinedHerocastViaHatsProtocolDraft);
    router.push('/post');
  };

  const getButtonLabel = () => {
    switch (state.state) {
      case SignupStateEnum.CONNECT_WALLET:
        return "Connect wallet";
      case SignupStateEnum.SELECT_FARCASTER_ACCOUNT:
        return `Connect to ${accountName || "Farcaster account"}`;
      case SignupStateEnum.CHECKING_IS_VALID_SIGNER:
        return (
          <p className="flex">
            <Cog6ToothIcon
              className="h-5 w-5 text-gray-500 animate-spin"
              aria-hidden="true"
            />
          </p>
        );
      case SignupStateEnum.CONFIRMED_IS_VALID_SIGNER:
        return "Do I need to sign again?";
      case SignupStateEnum.PENDING_ADD_KEY:
        return "Confirm herocast signer";
      case SignupStateEnum.CONFIRMED_ADD_KEY:
        return null;
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
        if (!address) {
          openConnectModal?.();
        } else {
          setState(HatsProtocolSignupSteps[1]);
        }
        break;
      case SignupStateEnum.SELECT_FARCASTER_ACCOUNT:
        if (!address || !accountName || delegatorContractAddress === '0x') return;

        onSignData();
        break;
      case SignupStateEnum.CONFIRMED_IS_VALID_SIGNER:
      case SignupStateEnum.CHECKING_IS_VALID_SIGNER:
        break;
      case SignupStateEnum.PENDING_ADD_KEY:
        onAddHerocastSignerToHatsProtocol();
        break;
      case SignupStateEnum.ERROR:
        break;
    }
  };

  const getCardContent = () => {
    switch (state.state) {
      case SignupStateEnum.SELECT_FARCASTER_ACCOUNT:
        return (
          <div className="flex flex-col">
            <div className="w-full">
              <p className="">Which account do you want to connect? (account name or FID)</p>
              <Input
                className="w-2/3"
                placeholder="herocast / 13596"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
              />
              <p className="mt-2 mb-1">
                What is the target Hats Protocol Delegator instance?
              </p>
              <Input
                className="w-2/3"
                placeholder="0x"
                value={delegatorContractAddress}
                onChange={(e) =>
                  e.target.value.startsWith("0x")
                    ? setDelegatorContractAddress(
                        e.target.value as `0x${string}`
                      )
                    : null
                }
              />
            </div>
          </div>
        );
      case SignupStateEnum.CHECKING_IS_VALID_SIGNER:
        return (
          <div className="flex flex-col">
            <div className="w-full">
              <p className="">
                Confirming your access
                <br />
                Looking up your hat with HatsProtocol and Farcaster.
              </p>
            </div>
          </div>
        );
      case SignupStateEnum.CONFIRMED_ADD_KEY:
        return (
          <div className="flex flex-col">
            <div className="w-full">
              <p className="">
                You have successfully connected your herocast account to Hats
                Protocol.
              </p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => onPublishTestCast()}
              >
                Publish test cast
              </Button>
            </div>
          </div>
        );
      default:
        return <></>;
    }
  };

  const buttonLabel = getButtonLabel();
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
              <Button
                className="ml-4"
                variant="outline"
                onClick={() => { setState(HatsProtocolSignupSteps[0]); setErrorMessage("")} }
              >
                Reset
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter>
          {buttonLabel && (
            <Button
              className="w-full"
              variant="default"
              disabled={
                state.state === SignupStateEnum.CHECKING_IS_VALID_SIGNER
              }
              onClick={() => onClick()}
            >
              {buttonLabel}
            </Button>
          )}
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
