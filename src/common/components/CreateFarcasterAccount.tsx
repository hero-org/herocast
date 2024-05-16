import React, { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loading } from "./Loading";

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
import { PaymentOption } from "node_modules/@paywithglide/glide-js/dist/types";
import { optimismChainId } from "../helpers/env";
import { config } from "../helpers/rainbowkit";

const CreateFarcasterAccount = ({ onSuccess, isAddressValid }: { onSuccess?: () => void, isAddressValid: boolean }) => {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string>();
  const [transactionHash, setTransactionHash] = useState<Hex>("0x");
  const { address, isConnected, chain } = useAccount();
  const walletClient = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const { signTypedDataAsync } = useSignTypedData();
  const [paymentOption, setPaymentOption] = useState<PaymentOption>();
  const [areTransactionsSigned, setAreTransactionsSigned] = useState<boolean>(false);
  const [registerSignature, setRegisterSignature] = useState<Hex>();
  const [addSignature, setAddSignature] = useState<Hex>();
  const [savedPublicKey, setPublicKey] = useState<Hex>();
  const [registerMetaData, setRegisterMetaData] = useState<Hex>();
  const [deadline, setDeadline] = useState<bigint>();

  const { accounts, addAccount, setAccountActive } = useAccountStore();
  const pendingAccounts = accounts.filter(
    (account) =>
      account.status === AccountStatusType.pending &&
      account.platform === AccountPlatformType.farcaster
  );

  
  const chainId = optimismChainId;
  console.log('DEBUG pendingAccounts', pendingAccounts.length, pendingAccounts)
  console.log('DEBUG chainId', chainId)

  const { data: price } = useReadContract({
    chainId,
    address: BUNDLER_ADDRESS,
    abi: bundlerABI,
    functionName: "price",
    args: [0n],
  });

  const transactionResult = useWaitForTransactionReceipt({
    hash: transactionHash,
    config,
    query: {
      enabled: transactionHash != '0x'
    }
  });

  useEffect(() => {
    if (!isConnected || transactionHash === "0x" || !transactionResult) return;
    getFidAndUpdateAccount();
  }, [isConnected, transactionHash, transactionResult, pendingAccounts]);

  const getFidAndUpdateAccount = async (): Promise<boolean> => {
    console.log(
      "getFidAndUpdateAccount",
      address,
      "pending accounts",
      pendingAccounts.length,
      "transactionResult",
      transactionResult?.data
    );
    if (!(transactionResult && pendingAccounts.length > 0)) return false;
    try {
      const fid = await getFidForAddress(address!)
      console.log('DEBUG fid', fid)
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
      console.log("error when trying to get fid", e);
      setError(`Error when trying to get fid: ${e}`);
    }
    return false;
  };

  const registerAccount = async () => {
    // todo: use pending account instead of savedPublicKey
    if (
      !registerSignature
      || !savedPublicKey
      || !address
      || !registerMetaData
      || !deadline
      || !addSignature
    ) {
      setError("Something went wrong setting up the glide payment transaction!");
      return;
    }

    if (!paymentOption) {
      setError("You need to select a payment option to proceed!");
      return;
    }

    try {
      if (!address) {
        throw new Error("No address");
      }

      setIsPending(true);
      console.log('DEBUG registerAccount', address, chainId, paymentOption?.paymentCurrency, price, BUNDLER_ADDRESS, bundlerABI, registerSignature, addSignature, deadline, savedPublicKey, registerMetaData)
      const registerAccountTransactionHash = await glideClient.writeContract({
        account: address,
        chainId,
        paymentCurrency: paymentOption?.paymentCurrency,
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
      console.log(
        "registerAccountTransactionHash",
        registerAccountTransactionHash
      );
      setTransactionHash(registerAccountTransactionHash);
      setIsPending(false);
    } catch (e) {
      if (e instanceof NoPaymentOptionsError) {
        setError(
          "Wallet has no tokens to pay for transaction. Please add tokens to your wallet.",
        );
        setIsPending(false);
        return;
      }

      console.log("error when trying to write contract", e);
      const errorStr = String(e).split("Raw Call Arguments")[0];
      setError(`when adding account onchain: ${errorStr}`);
      setIsPending(false);
      return;
    }
  }

  const switchNetwork = async () => {
    setError('')
    try {
      const result = await switchChainAsync({
        chainId
      });
      if (result.id !== chainId) {
        setError(`Expecting switch to ${chainId}.  Switched to ${result.id} instead.`);
      } else {
        return true;
      }
    } catch (e: any) {
      setError('You must switch networks to get available payment methods: '+  JSON.stringify(e))
    }
    return false;
  }

  const getSignatures = async () => {
    setIsPending(true);

    if (isConnected && (chain?.id !== chainId)) {
      const isConnected = await switchNetwork();
      if (!isConnected) {
        return;
      }
    }

    let signerPublicKey, signerPrivateKey;
    if (!pendingAccounts || pendingAccounts.length === 0) {
      console.log('DEBUG found no pending account, creating a new one in DB')
      const { publicKey, privateKey } = await generateKeyPair();
      signerPublicKey = bytesToHexString(publicKey)._unsafeUnwrap();
      signerPrivateKey = bytesToHexString(privateKey)._unsafeUnwrap();
      setPublicKey(signerPublicKey);

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
        console.log("error when trying to add account", e);
        setIsPending(false);
        setError(`Error when trying to add account: ${e}`);
        return;
      }
    } else {
      console.log('DEBUG has existing pending account, so using this one from DB', pendingAccounts[0].publicKey)
      signerPublicKey = pendingAccounts[0].publicKey!;
      signerPrivateKey = pendingAccounts[0].privateKey!;
      setPublicKey(pendingAccounts[0].publicKey);
    }

    const nonce = await readNoncesFromKeyGateway(address!);
    const registerDeadline = getDeadline();
    setDeadline(registerDeadline);

    try {
      const registerSignature = await walletClient.data?.signTypedData({
        ...ID_GATEWAY_EIP_712_TYPES,
        domain: {
          ...ID_GATEWAY_EIP_712_TYPES.domain,
          chainId,
        },
        primaryType: "Register",
        message: {
          to: address!,
          recovery: WARPCAST_RECOVERY_PROXY,
          nonce,
          deadline: registerDeadline,
        }
      })
      if (!registerSignature) {
        throw new Error("No signature");
      }

      setRegisterSignature(registerSignature);
    } catch (e) {
      setIsPending(false);
      setError(
        `Error when trying to sign register: ${JSON.stringify(e)}`
      );
      return;
    }

    const metadata = await getSignedKeyRequestMetadataFromAppAccount(
      chainId,
      signerPublicKey,
      registerDeadline
    );
    
    setRegisterMetaData(metadata);
    try {
      const addSignature = await walletClient.data?.signTypedData({
        ...KEY_GATEWAY_EIP_712_TYPES,
        domain: {
          ...KEY_GATEWAY_EIP_712_TYPES.domain,
          chainId,
        },
        primaryType: "Add",
        message: {
          owner: address!,
          keyType: 1,
          key: signerPublicKey,
          metadataType: 1,
          metadata,
          nonce,
          deadline: registerDeadline,
        }
      });
      setAddSignature(addSignature);
      setAreTransactionsSigned(true);
    } catch (e) {
      console.log("error when trying to sign add", e);
      setError(`Error when trying to sign add: ${e}`);
      setIsPending(false);
    }
  };

  return (
    <div className="w-3/4 space-y-4">
      <p className="text-[0.8rem] text-muted-foreground">
        Creating an account will require two wallet signatures and one on-chain transaction.{" "}
        <br /><br />
        You can pay for the transaction and Farcaster platform fee with ETH or
        other tokens on Base, Optimism, Arbitrum, Polygon, or Ethereum.
        <br /><br />
        The yearly Farcaster platform fee at the moment is{" "}
        {price && price > 0n
          ? `~${parseFloat(formatEther(price)).toFixed(8)} ETH.`
          : <Loading isInline={true} />}
      </p>
      <Separator />
      <p className="text-[0.8rem] text-muted-foreground">
        First sign the transactions, this will then find the tokens that you can pay with.
      </p>
      {areTransactionsSigned
        ? <PaymentSelector
          registerPrice={price}
          chainId={chainId}
          registerSignature={registerSignature}
          addSignature={addSignature}
          setPaymentOption={setPaymentOption}
          paymentOption={paymentOption}
          deadline={deadline}
          metadata={registerMetaData}
          publicKey={savedPublicKey}
          setError={setError}
        />
        : <Button
          onClick={() => getSignatures()}
          disabled={isPending || !isAddressValid || !price}
        >
          Sign to view Payment Options
          {isPending && (
            <div className="pointer-events-none ml-3">
              <Cog6ToothIcon
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            </div>
          )}
        </Button>}
        
      {!isAddressValid && (
        <div className="flex flex-start items-center mt-2">
          <p className="text-wrap break-all	text-sm text-red-500">
            The wallet address you are connected to already has an account. Go back and connect another address.
          </p>
        </div>
      )}
      <Separator />
      <p className="text-[0.8rem] text-muted-foreground">
        Then, once your payment choice is selected, proceed with payment.
      </p>
      <Button
        variant="outline"
        disabled={!areTransactionsSigned || !paymentOption}
        onClick={() => registerAccount()}
      >
        Pay & Register
      </Button>
      {(!areTransactionsSigned && isPending) && (
        <Button
          variant="outline"
          className="ml-4"
          onClick={() => getFidAndUpdateAccount()}
        >
          Manual refresh 🔄
        </Button>
      )}
      {error && (
        <div className="flex flex-start items-center mt-2">
          <p className="text-wrap break-all	text-sm text-red-500">
            Error: {error}
          </p>
        </div>
      )}
      

      <div>
        <a href="https://paywithglide.xyz" target="_blank" rel="noreferrer" className="text-sm cursor-pointer text-muted-foreground text-font-medium hover:underline hover:text-blue-500/70">
          Payments powered by Glide
        </a>
      </div>

    </div>
  );
};

export default CreateFarcasterAccount;
