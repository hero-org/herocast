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
import { framesJsAccountStatusMap } from "@/common/constants/accounts";

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


export default function Frame( { url, account } : { url: string, account?: AccountObjectType }) {
    const signer: FarcasterSigner | undefined = account && account.privateKey && account.publicKey ? {
        ...account,
        fid: Number(account.platformAccountId),
        status: framesJsAccountStatusMap[account.status] || "impersonating",
        privateKey: account.privateKey!,
        publicKey: account.publicKey!,
      } : undefined;

    const frameState = useFrame({
        homeframeUrl: url,
        connectedAddress: account?.publicKey,
        frameActionProxy: "/api/frames",
        frameGetProxy: "/api/frames",
        frameContext: fallbackFrameContext,
        signerState: {
            hasSigner: true,
            signer,
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