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


export default function Frame( { homeFrameUrl, account } : { homeFrameUrl: string, account?: AccountObjectType }) {
    const farcasterSigner: FarcasterSigner = {
        fid: account?.id,
        status: account?.status,
        publicKey: account?.publicKey,
        privateKey: account?.privateKey,
    };

    const frameState = useFrame({
        homeframeUrl: homeFrameUrl,
        frameActionProxy: "/api/frames",
        frameGetProxy: "/api/frames",
        frameContext: fallbackFrameContext,
        signerState: {
            hasSigner: true,
            signer: farcasterSigner,
            onSignerlessFramePress: () => {
                alert("A frame button was pressed without a signer. Perhaps you want to prompt a login");
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