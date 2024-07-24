import React, { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loading } from "./Loading";
import { ArrowPathIcon } from "@heroicons/react/20/solid";
import {
  useAccount,
  useReadContract,
  useSendTransaction,
  useSignTypedData,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWalletClient,
} from "wagmi";
import {
  BUNDLER_ADDRESS,
  bundlerABI,
  ID_GATEWAY_EIP_712_TYPES,
  KEY_GATEWAY_EIP_712_TYPES,
  bytesToHexString,
} from "@farcaster/hub-web";
import {
  WARPCAST_RECOVERY_PROXY,
  getDeadline,
  getFidForAddress,
  getSignedKeyRequestMetadataFromAppAccount,
  readNoncesFromKeyGateway,
} from "../helpers/farcaster";
import { Hex, formatEther } from "viem";
import {
  PENDING_ACCOUNT_NAME_PLACEHOLDER,
  useAccountStore,
} from "@/stores/useAccountStore";
import { AccountPlatformType, AccountStatusType } from "../constants/accounts";
import { generateKeyPair } from "../helpers/warpcastLogin";
import { Cog6ToothIcon } from "@heroicons/react/20/solid";
import { glideClient } from "../helpers/glide";
import { NoPaymentOptionsError } from "@paywithglide/glide-js";
import { PaymentSelector } from "./PaymentSelector";
import { PaymentOption } from "@paywithglide/glide-js/dist/types";
import { optimismChainId } from "../helpers/env";
import { config } from "../helpers/rainbowkit";

const PaymentSection: React.FC<{
  state: {
    didSignTransactions: boolean;
    registerSignature?: Hex;
    addSignature?: Hex;
    paymentOption?: PaymentOption;
    deadline?: bigint;
    registerMetaData?: Hex;
    savedPublicKey?: Hex;
    isPending: boolean;
  };
  setState: React.Dispatch<React.SetStateAction<any>>;
  price: bigint | undefined;
  chainId: number;
  isAddressValid: boolean;
  getSignatures: () => Promise<void>;
}> = ({ state, setState, price, chainId, isAddressValid, getSignatures }) => (
  <>
    <p className="text-[0.8rem] text-muted-foreground">
      Choose your payment option by signing two messages
    </p>
    {state.didSignTransactions ? (
      <PaymentSelector
        registerPrice={price}
        chainId={chainId}
        registerSignature={state.registerSignature}
        addSignature={state.addSignature}
        setPaymentOption={(paymentOption) =>
          setState((prev) => ({ ...prev, paymentOption }))
        }
        paymentOption={state.paymentOption}
        deadline={state.deadline}
        metadata={state.registerMetaData}
        publicKey={state.savedPublicKey}
        setError={(error) => setState((prev) => ({ ...prev, error }))}
      />
    ) : (
      <Button
        onClick={getSignatures}
        disabled={state.isPending || !isAddressValid || !price}
      >
        Sign to view Payment Options
        {state.isPending && (
          <div className="pointer-events-none ml-3">
            <Cog6ToothIcon
              className="h-4 w-4 animate-spin"
              aria-hidden="true"
            />
          </div>
        )}
      </Button>
    )}
  </>
);

const InvalidAddressWarning: React.FC<{ isAddressValid: boolean }> = ({
  isAddressValid,
}) =>
  !isAddressValid && (
    <div className="flex flex-start items-center mt-2">
      <p className="text-wrap break-all text-sm text-red-500">
        The wallet address you are connected to already has an account. Go back
        and connect another address.
      </p>
    </div>
  );

const ActionButtons: React.FC<{
  state: any;
  registerAccount: () => Promise<void>;
  getFidAndUpdateAccount: () => Promise<boolean>;
}> = ({ state, registerAccount, getFidAndUpdateAccount }) => (
  <div className="flex flex-col space-y-4">
    {state.didSignTransactions &&
      state.paymentOption &&
      !state.isWaitingForFid && (
        <Button
          variant={state.isPending ? "outline" : "default"}
          disabled={
            state.isPending ||
            !state.didSignTransactions ||
            !state.paymentOption
          }
          onClick={registerAccount}
        >
          {state.isPending ? <Loading isInline /> : "Create account"}
        </Button>
      )}
    {state.isWaitingForFid && (
      <>
        <p className="text-sm text-muted-foreground">
          Waiting for your Farcaster ID to be generated. This may take a few
          moments.
        </p>
        <Button variant="outline" onClick={getFidAndUpdateAccount}>
          <ArrowPathIcon className="h-4 w-4 mr-2" />
          Manual refresh 🔄
        </Button>
      </>
    )}
    {!state.didSignTransactions && !state.isWaitingForFid && (
      <Button variant="outline" onClick={getFidAndUpdateAccount}>
        Manual refresh 🔄
      </Button>
    )}
  </div>
);

const ErrorMessage: React.FC<{ error: string | undefined }> = ({ error }) =>
  error && (
    <div className="flex flex-start items-center mt-2">
      <p className="text-wrap break-all text-sm text-red-500">Error: {error}</p>
    </div>
  );

const GlideAttribution: React.FC = () => (
  <div>
    <a
      href="https://paywithglide.xyz"
      target="_blank"
      rel="noreferrer"
      className="text-sm cursor-pointer text-muted-foreground text-font-medium hover:underline hover:text-blue-500/70"
    >
      Payments powered by Glide
    </a>
  </div>
);

const InfoSection: React.FC<{ price: bigint | undefined }> = ({ price }) => (
  <p className="text-[0.8rem] text-muted-foreground">
    The yearly Farcaster platform fee is{" "}
    {price && price > 0n ? (
      `~${parseFloat(formatEther(price)).toFixed(8)} ETH right now.`
    ) : (
      <Loading isInline />
    )}
    <br />
    <br />
    You can pay with ETH or other tokens on Base, Optimism, Arbitrum, Polygon,
    or Ethereum.
    <br />
    <br />
    Creating an account will require two wallet signatures and one on-chain
    transaction.
  </p>
);

const CreateFarcasterAccount: React.FC<{
  onSuccess?: () => void;
  isAddressValid: boolean;
}> = ({ onSuccess, isAddressValid }) => {
  const [state, setState] = useState({
    isPending: false,
    error: "",
    transactionHash: "0x" as Hex,
    paymentOption: undefined as PaymentOption | undefined,
    didSignTransactions: false,
    registerSignature: undefined as Hex | undefined,
    addSignature: undefined as Hex | undefined,
    savedPublicKey: undefined as Hex | undefined,
    registerMetaData: undefined as Hex | undefined,
    deadline: undefined as bigint | undefined,
    isWaitingForFid: false,
    fidPollingCount: 0,
  });

  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  const { address, isConnected, chain } = useAccount();
  const walletClient = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const { signTypedDataAsync } = useSignTypedData();

  const { accounts, addAccount, setAccountActive } = useAccountStore();
  const pendingAccounts = accounts.filter(
    (account) =>
      account.status === AccountStatusType.pending &&
      account.platform === AccountPlatformType.farcaster
  );

  const chainId = optimismChainId;

  const { data: price } = useReadContract({
    chainId,
    address: BUNDLER_ADDRESS,
    abi: bundlerABI,
    functionName: "price",
    args: [0n],
  });

  const transactionResult = useWaitForTransactionReceipt({
    hash: state.transactionHash,
    config,
    query: {
      enabled: state.transactionHash !== "0x",
    },
  });

  const getFidAndUpdateAccount = useCallback(async (): Promise<boolean> => {
    if (!(transactionResult && pendingAccounts.length > 0)) {
      console.log("No transaction results or pending accounts.");
      return false;
    }

    try {
      const fid = await getFidForAddress(address!);
      if (fid) {
        const accountId = pendingAccounts[0].id;
        setAccountActive(accountId, PENDING_ACCOUNT_NAME_PLACEHOLDER, {
          platform_account_id: fid.toString(),
          data: { signupViaHerocast: true },
        });
        onSuccess?.();
        return true;
      }
    } catch (e) {
      console.error("Error when trying to get fid", e);
      setState((prev) => ({
        ...prev,
        error: `Error when trying to get fid: ${e}`,
      }));
    }
    return false;
  }, [
    address,
    pendingAccounts,
    transactionResult,
    setAccountActive,
    onSuccess,
  ]);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const pollForFid = async () => {
      if (isConnected && state.transactionHash !== "0x" && transactionResult) {
        const success = await getFidAndUpdateAccount();
        if (success && isMounted) {
          setState((prev) => ({ ...prev, isWaitingForFid: false }));
        } else if (isMounted) {
          timeoutId = setTimeout(pollForFid, 1000);
        }
      }
    };

    if (isConnected && state.transactionHash !== "0x" && transactionResult) {
      setState((prev) => ({ ...prev, isWaitingForFid: true }));
      pollForFid();
    }

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isConnected, state.transactionHash, transactionResult, getFidAndUpdateAccount]);

  const registerAccount = async () => {
    const {
      registerSignature,
      savedPublicKey,
      registerMetaData,
      deadline,
      addSignature,
      paymentOption,
    } = state;

    if (
      !registerSignature ||
      !savedPublicKey ||
      !address ||
      !registerMetaData ||
      !deadline ||
      !addSignature
    ) {
      setState((prev) => ({
        ...prev,
        error: "Something went wrong setting up the glide payment transaction!",
      }));
      return;
    }

    if (!paymentOption) {
      setState((prev) => ({
        ...prev,
        error: "You need to select a payment option to proceed!",
      }));
      return;
    }

    try {
      setState((prev) => ({ ...prev, isPending: true }));
      const registerAccountTransactionHash = await glideClient.writeContract({
        account: address,
        chainId,
        paymentCurrency: paymentOption.paymentCurrency,
        value: price,
        address: BUNDLER_ADDRESS,
        abi: bundlerABI,
        functionName: "register",
        args: [
          {
            to: address,
            recovery: WARPCAST_RECOVERY_PROXY,
            sig: registerSignature,
            deadline,
          },
          [
            {
              keyType: 1,
              key: savedPublicKey,
              metadataType: 1,
              metadata: registerMetaData,
              sig: addSignature,
              deadline,
            },
          ],
          0n,
        ],
        switchChainAsync,
        sendTransactionAsync,
        signTypedDataAsync,
      });

      setState((prev) => ({
        ...prev,
        transactionHash: registerAccountTransactionHash,
        isPending: false,
      }));
    } catch (e) {
      if (e instanceof NoPaymentOptionsError) {
        setState((prev) => ({
          ...prev,
          error:
            "Wallet has no tokens to pay for transaction. Please add tokens to your wallet.",
          isPending: false,
        }));
      } else {
        console.error("Error when trying to write contract", e);
        const errorStr = String(e).split("Raw Call Arguments")[0];
        setState((prev) => ({
          ...prev,
          error: `Error when adding account onchain: ${errorStr}`,
          isPending: false,
        }));
      }
    }
  };

  const switchNetwork = async () => {
    setState((prev) => ({ ...prev, error: "" }));
    try {
      const result = await switchChainAsync({ chainId });
      if (result.id !== chainId) {
        setState((prev) => ({
          ...prev,
          error: `Expecting switch to ${chainId}. Switched to ${result.id} instead.`,
        }));
      } else {
        return true;
      }
    } catch (e: any) {
      setState((prev) => ({
        ...prev,
        error: `You must switch networks to get available payment methods: ${JSON.stringify(
          e
        )}`,
      }));
    }
    return false;
  };

  const getSignatures = async () => {
    setState((prev) => ({ ...prev, isPending: true }));

    if (isConnected && chain?.id !== chainId) {
      const isConnected = await switchNetwork();
      if (!isConnected) return;
    }

    let signerPublicKey, signerPrivateKey;
    if (!pendingAccounts || pendingAccounts.length === 0) {
      const { publicKey, privateKey } = await generateKeyPair();
      signerPublicKey = bytesToHexString(publicKey)._unsafeUnwrap();
      signerPrivateKey = bytesToHexString(privateKey)._unsafeUnwrap();
      setState((prev) => ({ ...prev, savedPublicKey: signerPublicKey }));

      try {
        await addAccount({
          account: {
            status: AccountStatusType.pending,
            platform: AccountPlatformType.farcaster,
            publicKey: signerPublicKey,
            privateKey: signerPrivateKey,
          },
        });
      } catch (e) {
        console.error("Error when trying to add account", e);
        setState((prev) => ({
          ...prev,
          isPending: false,
          error: `Error when trying to add account: ${e}`,
        }));
        return;
      }
    } else {
      signerPublicKey = pendingAccounts[0].publicKey!;
      signerPrivateKey = pendingAccounts[0].privateKey!;
      setState((prev) => ({
        ...prev,
        savedPublicKey: pendingAccounts[0].publicKey,
      }));
    }

    const nonce = await readNoncesFromKeyGateway(address!);
    const registerDeadline = getDeadline();
    setState((prev) => ({ ...prev, deadline: registerDeadline }));

    try {
      const registerSignature = await walletClient.data?.signTypedData({
        ...ID_GATEWAY_EIP_712_TYPES,
        domain: { ...ID_GATEWAY_EIP_712_TYPES.domain, chainId },
        primaryType: "Register",
        message: {
          to: address!,
          recovery: WARPCAST_RECOVERY_PROXY,
          nonce,
          deadline: registerDeadline,
        },
      });
      if (!registerSignature) throw new Error("No signature");
      setState((prev) => ({ ...prev, registerSignature }));
    } catch (e) {
      setState((prev) => ({
        ...prev,
        isPending: false,
        error: `Error when trying to sign register: ${JSON.stringify(e)}`,
      }));
      return;
    }

    const metadata = await getSignedKeyRequestMetadataFromAppAccount(
      chainId,
      signerPublicKey,
      registerDeadline
    );
    setState((prev) => ({ ...prev, registerMetaData: metadata }));

    try {
      const addSignature = await walletClient.data?.signTypedData({
        ...KEY_GATEWAY_EIP_712_TYPES,
        domain: { ...KEY_GATEWAY_EIP_712_TYPES.domain, chainId },
        primaryType: "Add",
        message: {
          owner: address!,
          keyType: 1,
          key: signerPublicKey,
          metadataType: 1,
          metadata,
          nonce,
          deadline: registerDeadline,
        },
      });
      setState((prev) => ({
        ...prev,
        addSignature,
        didSignTransactions: true,
        isPending: false,
      }));
    } catch (e) {
      console.error("Error when trying to sign add", e);
      setState((prev) => ({
        ...prev,
        error: `Error when trying to sign add: ${e}`,
        isPending: false,
      }));
    }
  };

  return (
    <div className="w-full space-y-4">
      <InfoSection price={price} />
      <Separator />
      <PaymentSection
        state={state}
        setState={setState}
        price={price}
        chainId={chainId}
        isAddressValid={isAddressValid}
        getSignatures={getSignatures}
      />
      <InvalidAddressWarning isAddressValid={isAddressValid} />
      <Separator />
      <ActionButtons
        state={state}
        registerAccount={registerAccount}
        getFidAndUpdateAccount={getFidAndUpdateAccount}
      />
      <ErrorMessage error={state.error} />
      <GlideAttribution />
    </div>
  );
};

export default CreateFarcasterAccount;
