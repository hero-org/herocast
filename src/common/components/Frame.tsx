"use client";
import * as React from "react"
import Image from "next/image";
import type { ImgHTMLAttributes } from "react";
import {
    FrameUI,
    fallbackFrameContext,
} from "@frames.js/render";
import { signFrameAction, FarcasterSigner } from '@frames.js/render/farcaster'
import { useFrame } from "@frames.js/render/use-frame";
import {AccountObjectType} from "@/stores/useAccountStore";
import { useAccount } from "wagmi";

export function FrameImageNext(
    props: ImgHTMLAttributes<HTMLImageElement> & { src: string }
): React.JSX.Element {
    return (
        <Image
            {...props}
            alt={props.alt ?? ""}
            sizes="100vw"
            height={0}
            width={0}
        />
    );
}


export default function Frame({ homeFrameUrl, account } : { homeFrameUrl: string, account?: AccountObjectType }) {
    const { address } = useAccount();

    const farcasterSigner: FarcasterSigner | undefined = account ? {
        fid: Number(account?.platformAccountId),
        status: account?.status,
        publicKey: account?.publicKey,
        privateKey: account?.privateKey,
    } : undefined;

    const frameState = useFrame({
        homeframeUrl: homeFrameUrl,
        connectedAddress: address,
        frameActionProxy: "/api/frames",
        frameGetProxy: "/api/frames",
        frameContext: fallbackFrameContext,
        signerState: {
            // keep true, some frame buttons are just links, setting this to true doesn't let you press them
            hasSigner: true,
            signer: farcasterSigner,
            onSignerlessFramePress: () => {
                alert("A frame button was pressed without a signer.");
            },
            signFrameAction: signFrameAction,
        },
    });

    return (
        <div className="w-[400px]">
            <FrameUI frameState={frameState} theme={{}} FrameImage={FrameImageNext} />
        </div>
    );
}