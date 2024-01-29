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
  HatsFarcasterDelegatorContractAddress,
} from "@/common/constants/contracts/HatsFarcasterDelegator";
import {
  encodeAbiParameters,
  encodePacked,
  hashTypedData,
  keccak256,
  toHex,
} from "viem";
import {
  ID_REGISTRY_ADDRESS,
  KEY_GATEWAY_ADDRESS,
  KEY_GATEWAY_ADD_TYPE,
  KEY_GATEWAY_EIP_712_DOMAIN,
  SIGNED_KEY_REQUEST_TYPE,
  SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
  ViemWalletEip712Signer,
  bytesToHexString,
  idRegistryABI,
  keyGatewayABI,
} from "@farcaster/hub-web";
import { Cog6ToothIcon } from "@heroicons/react/20/solid";
import { config, publicClient } from "@/common/helpers/rainbowkit";
import {
  getDeadline,
  publishCastWithLocalWallet,
} from "@/common/helpers/farcaster";
import { formatPlaintextToHubCastMessage } from "@mod-protocol/farcaster";
import {
  writeContract,
  getWalletClient,
} from "@wagmi/core";
import {
  generateKeyPair,
} from "@/common/helpers/warpcastLogin";
import {
  AccountPlatformType,
  AccountStatusType,
} from "@/common/constants/accounts";
import { useAccountStore } from "@/stores/useAccountStore";

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

const readNoncesfromIdRegistry = async (account: `0x${string}`) => {
  return await publicClient.readContract({
    address: ID_REGISTRY_ADDRESS,
    abi: idRegistryABI,
    functionName: "nonces",
    args: [account],
  });
};

const readNoncesFromKeyGateway = async (account: `0x${string}`) => {
  return await publicClient.readContract({
    abi: keyGatewayABI,
    address: KEY_GATEWAY_ADDRESS,
    functionName: "nonces",
    args: [account],
  });
};

async function isValidSignature(
  hash: `0x${string}`,
  sig: `0x${string}`
): Promise<boolean> {
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
const ADD_TYPEHASH = keccak256(
  toHex(
    "Add(address owner,uint32 keyType,bytes key,uint8 metadataType,bytes metadata,uint256 nonce,uint256 deadline)"
  )
);

const ConnectFarcasterAccountViaHatsProtocol = () => {
  const [state, setState] = useState<SignupStepType>(
    HatsProtocolSignupSteps[1]
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [accountName, setAccountName] = useState("");
  const [deadline, setDeadline] = useState<bigint>(BigInt(0));
  const [signature, setSignature] = useState<`0x${string}`>("0x");
  const [delegatorContractAddress, setDelegatorContractAddress] =
    useState<`0x${string}`>("0x2564F40382aEDb5dd849E792911B28AaE52a4ACf");
  const [fid, setFid] = useState(232233);
  const [onchainTransactionHash, setOnchainTransactionHash] =
    useState<`0x${string}`>("0x");

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

  const onSignData = async () => {
    if (!address) return;

    // const neynarClient = new NeynarAPIClient(
    //   process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
    // );
    // let fid: number | undefined;
    // try {
    //   const resp = await neynarClient.lookupUserByUsername(
    //     accountName,
    //     parseInt(APP_FID)
    //   );
    //   fid = resp.result.user?.fid;
    // } catch (err) {
    //   console.log(
    //     "ConnectFarcasterAccountViaHatsProtocol: error getting data",
    //     err
    //   );
    // }
    // if (!fid) {
    //   setErrorMessage(`User ${accountName} not found`);
    //   return;
    // }
    const newDeadline = BigInt(getDeadline());
    setDeadline(newDeadline);
    setState(HatsProtocolSignupSteps[3]);
    return;

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
        deadline: newDeadline,
      },
    };
    const hash = hashTypedData(typedData);
    const newSignature = await signTypedDataAsync(typedData);
    const typeHash = keccak256(
      toHex("SignedKeyRequest(uint256 requestFid,bytes key,uint256 deadline)")
    );

    const sig = encodePacked(
      ["bytes", "bytes32", "uint256", "bytes", "uint256"],
      [newSignature, typeHash, BigInt(fid), keccak256(key), newDeadline]
    );

    const result = await readContract(config, {
      address: HatsFarcasterDelegatorContractAddress,
      abi: HatsFarcasterDelegatorAbi,
      functionName: "isValidSignature",
      args: [hash, sig],
    });

    console.log("readContract result", result);
    if (result === "0x1626ba7e") {
      setSignature(newSignature);
      setState(HatsProtocolSignupSteps[3]);
    } else {
      setState(HatsProtocolSignupSteps[5]);
    }
  };

  const onAddHerocastSignerToHatsProtocol = async () => {
    if (!address) return;

    let hexStringPublicKey, hexStringPrivateKey;
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
      hexStringPrivateKey = hatsProtocolPendingAccounts[0].privateKey;
    }

    // const addressNounce = await readNoncesFromKeyGateway(address)
    // console.log('KeyGateway: wallet nonce', addressNounce, 'delegatorContract nonce', nonce)
    // const nonce = await readNoncesFromKeyGateway(address);
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
    console.log('metadataSignature', metadataSignature)

    const METADATA_TYPEHASH = '0x16be47f1f1f50a66a48db64eba3fd35c21439c23622e513aab5b902018aec438';
    const metadata = encodePacked(
      ["bytes", "bytes32", "uint256", "bytes", "uint256"],
      [metadataSignature, METADATA_TYPEHASH, BigInt(fid), keccak256(hexStringPublicKey), deadline]
    );

    console.log('isMetadataSignatureValid', await isValidSignature(metadataHash, metadata));

    const typedData = {
      domain: KEY_GATEWAY_EIP_712_DOMAIN,
      types: {
        Add: KEY_GATEWAY_ADD_TYPE,
      },
      primaryType: "Add" as const,
      message: {
        owner: delegatorContractAddress,
        keyType: 1, // only supports 1 as key type
        key: hexStringPublicKey,
        metadataType: 1, // only supports 1 as metadata type
        metadata,
        deadline,
        nonce,
      },
    };

    const addHash = hashTypedData(typedData);
    const addSignature = await signTypedDataAsync(typedData);

    // signature, typehash, and then all the args
    const sig = encodePacked(
      [
        "bytes",
        "bytes32",
        "address",
        "uint32",
        "bytes",
        "uint8",
        "bytes",
        "uint256",
        "uint256",
      ],
      [
        addSignature,
        ADD_TYPEHASH,
        delegatorContractAddress,
        1,
        keccak256(hexStringPublicKey),
        1,
        keccak256(metadata),
        nonce,
        deadline,
      ]
    );

    const isValid = await isValidSignature(addHash, sig);
    if (!isValid) {
      setState(HatsProtocolSignupSteps[5]);
      return;
    }

    const tx = await writeContract(config, {
      abi: keyGatewayABI,
      address: KEY_GATEWAY_ADDRESS,
      functionName: "addFor",
      args: [
        delegatorContractAddress,
        1,
        hexStringPublicKey,
        1,
        metadata,
        deadline,
        sig,
      ],
    });

    console.log("result tx", tx);
    setOnchainTransactionHash(tx);
    // add a the herocast signer to the HatsProtocol contract
  };

  const transactionResult = useWaitForTransactionReceipt({
    hash: onchainTransactionHash,
  });

  useEffect(() => {
    if (onchainTransactionHash === "0x") return;

    if (transactionResult) {
      setState(HatsProtocolSignupSteps[4]);
    }
  }, [onchainTransactionHash, transactionResult]);

  const publishTestCast = async () => {
    if (!address) return;

    const castBody = await formatPlaintextToHubCastMessage({
      text: "you must be the cast you wish to see in the world",
      embeds: [],
      getMentionFidsByUsernames: async () => [],
    });

    if (!castBody) {
      console.log(
        "ConnectFarcasterAccountViaHatsProtocol: error formatting cast body"
      );
      return;
    }

    // const accountKey = new NobleEd25519Signer(accountPrivateKey);
    // const dataOptions = {
    //   fid: fid,
    //   network: FC_NETWORK,
    // };
    // const userDataUsernameBody = {
    //   type: UserDataType.USERNAME,
    //   value: fname,
    // };
    // // Set the username
    // await submitMessage(
    //   makeUserDataAdd(userDataUsernameBody, dataOptions, accountKey)
    // );
    const client = await getWalletClient(config, {
      account: address,
    });
    const wallet = new ViemWalletEip712Signer(client);
    publishCastWithLocalWallet({ authorFid: fid.toString(), wallet, castBody });
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
        openConnectModal?.();
        break;
      case SignupStateEnum.SELECT_FARCASTER_ACCOUNT:
        if (!address) return;

        setState(HatsProtocolSignupSteps[2]);
        onSignData();
        break;
      case SignupStateEnum.CONFIRMED_IS_VALID_SIGNER:
      case SignupStateEnum.CHECKING_IS_VALID_SIGNER:
        break;
      case SignupStateEnum.PENDING_ADD_KEY:
        onAddHerocastSignerToHatsProtocol();
        // setState(HatsProtocolSignupSteps[4]);
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
            <div className="w-2/3">
              {/* <p className="">Which account do you want to connect?</p>
              <Input
                placeholder="herocast"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
              /> */}
              <p className="mb-1">
                What is the target Hats Protocol Delegator instance?
              </p>
              <Input
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
                onClick={() => publishTestCast()}
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
            disabled={state.state === SignupStateEnum.CHECKING_IS_VALID_SIGNER}
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
