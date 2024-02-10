import React, { useEffect, useState } from "react";
import { encodeAbiParameters } from 'viem';
import {
    useAccount,
    useContractRead,
    useContractWrite,
    useNetwork,
    usePrepareContractWrite,
    useReadContract,
    useSwitchNetwork,
    useWaitForTransaction,
    useWriteContract
} from 'wagmi';
import { Button } from "@/components/ui/button";
import { KEY_REGISTRY } from "../constants/contracts/key-registry";
import { CheckIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";
import { ID_REGISTRY } from "../constants/contracts/id-registry";
import { mnemonicToAccount } from "viem/accounts";
import { AccountObjectType } from "@/stores/useAccountStore";
import isEmpty from "lodash.isempty";
import { useAccountModal } from "@rainbow-me/rainbowkit";

const APP_FID = process.env.NEXT_PUBLIC_APP_FID!;
const APP_MNENOMIC = process.env.NEXT_PUBLIC_APP_MNENOMIC!;

const SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN = {
    name: 'Farcaster SignedKeyRequestValidator',
    version: '1',
    chainId: 10,
    verifyingContract: '0x00000000fc700472606ed4fa22623acf62c60553'
} as const;

const SIGNED_KEY_REQUEST_TYPE = [
    { name: 'requestFid', type: 'uint256' },
    { name: 'key', type: 'bytes' },
    { name: 'deadline', type: 'uint256' }
] as const;

const SIGNED_KEY_REQUEST_TYPE_V2 = [
    {
        components: [
            {
                internalType: 'uint256',
                name: 'requestFid',
                type: 'uint256',
            },
            {
                internalType: 'address',
                name: 'requestSigner',
                type: 'address',
            },
            {
                internalType: 'bytes',
                name: 'signature',
                type: 'bytes',
            },
            {
                internalType: 'uint256',
                name: 'deadline',
                type: 'uint256',
            },
        ],
        internalType: 'struct SignedKeyRequestValidator.SignedKeyRequestMetadata',
        name: 'metadata',
        type: 'tuple',
    },
] as const


type ConfirmOnchainSignerButtonType = {
    account: AccountObjectType
}

const ConfirmOnchainSignerButton = ({ account }: ConfirmOnchainSignerButtonType) => {
    const [signature, setSignature] = useState('');
    const { openAccountModal } = useAccountModal();

    const { address } = useAccount();
    const { data: idOfUser, error: idOfUserError } = useReadContract({
        ...ID_REGISTRY,
        chainId: 10,
        functionName: address ? 'idOf' : undefined,
        args: address ? [address] : undefined
    });

    if (idOfUserError) console.log('idOfUserError', idOfUserError);

    const enabled = !isEmpty(account) && !isEmpty(account?.data) && signature !== '';
    const appAccount = mnemonicToAccount(APP_MNENOMIC);
    const deadline = Math.floor(Date.now() / 1000) + 86400; // signature is valid for 1 day

    useEffect(() => {
        const getSignature = async () => {
            const res = await appAccount.signTypedData({
                domain: SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
                types: {
                    SignedKeyRequest: SIGNED_KEY_REQUEST_TYPE,
                },
                primaryType: "SignedKeyRequest",
                message: {
                    requestFid: BigInt(APP_FID),
                    key: account.publicKey as `0x${string}`,
                    deadline: BigInt(deadline),
                },
            });

            setSignature(res);
            console.log('getSignature done', res);
        };

        getSignature();
    }, [account, deadline]);

    const { config: addKeyConfig, error: prepareToAddKeyError } = usePrepareContractWrite({
        ...KEY_REGISTRY,
        chainId: 10,
        functionName: enabled ? 'add' : undefined,
        args: [
            1,
            account.publicKey as `0x${string}`,
            1,
            enabled
                ? encodeAbiParameters(SIGNED_KEY_REQUEST_TYPE_V2, [
                    {
                        requestFid: BigInt(APP_FID),
                        requestSigner: appAccount.address,
                        signature: signature as `0x${string}`,
                        deadline: BigInt(deadline),
                    }
                ])
                : `0x00`
        ],
        enabled
    });

    const {
        write: addKey,
        data: addKeySignResult,
        isLoading: addKeySignPending,
        isSuccess: addKeySignSuccess,
        error: addKeyError
    } = useWriteContract(addKeyConfig);

    const {
        // data: addKeyTxReceipt,
        // isSuccess: isAddKeyTxSuccess,
        isLoading: isAddKeyTxLoading
    } = useWaitForTransaction({ hash: addKeySignResult?.hash });

    const onClick = () => {
        if (chain?.id !== 10) {
            switchNetwork?.(10);
        } else if (!idOfUser) {
            openAccountModal?.();
        } else {
            addKey?.();
        }
    }

    const isPending = addKeySignPending || isAddKeyTxLoading;
    const isError = addKeyError !== null || prepareToAddKeyError !== null;

    const getButtonText = () => {
        if (addKeySignPending) return 'Waiting for you to sign in your wallet'
        if (isAddKeyTxLoading) return 'Waiting for onchain transaction to be confirmed'
        if (addKeySignSuccess) return 'Confirmed onchain'
        if (chain?.id !== 10) return 'Switch to Optimism'
        if (!idOfUser) return 'Switch wallet'
        if (prepareToAddKeyError) return 'Failed to prepare onchain request'
        if (addKeyError) return 'Failed to execute onchain request'
        return 'Confirm account onchain'
    }

    return (
        <>
            {address && !idOfUser && (
                <p className="mb-2 text-sm text-foreground/70">Connected wallet {address.slice(0, 6)}...{address.slice(-6)} is not registered on Farcaster</p>
            )}
            <Button
                variant="default"
                className="w-full"
                onClick={() => onClick()}
                disabled={!enabled || addKeySignPending || addKeySignSuccess || isError}
            >
                {isPending && (
                    <Cog6ToothIcon className="mr-1.5 h-5 w-5 text-foreground/80 animate-spin" aria-hidden="true" />
                )}
                {addKeySignSuccess && (
                    <CheckIcon className="mr-1.5 h-5 w-5 text-foreground/70" aria-hidden="true" />
                )}
                {getButtonText()}
            </Button>
        </>
    )
}

export default ConfirmOnchainSignerButton;