import React, { useState } from "react";
import { FrameUI, fallbackFrameContext } from "@frames.js/render";
import { signFrameAction } from "@frames.js/render/farcaster";
import { useFrame } from "@frames.js/render/use-frame";
import { AccountObjectType, useAccountStore } from "@/stores/useAccountStore";
import { framesJsAccountStatusMap } from "@/common/constants/accounts";
import Image from "next/image";
import type { ImgHTMLAttributes } from "react";
import { isUndefined } from "lodash";
import { WarpcastImage } from "../PostEmbeddedContent";

// Due to issue with FrameImageNext from @frame.js/render/next
// Implement the exact same thing again
function FrameImageNext(
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

type FrameArgs = {
  url: string;
};

const FrameEmbed = ({ url }: FrameArgs) => {
  const { selectedAccountIdx, accounts } = useAccountStore();
  const account: AccountObjectType | undefined = accounts[selectedAccountIdx];

  const signer =
    account && account.privateKey && account.publicKey
      ? {
          ...account,
          fid: Number(account.platformAccountId),
          status: framesJsAccountStatusMap[account.status] || "impersonating",
          privateKey: account.privateKey!,
          publicKey: account.publicKey!,
        }
      : undefined;

  const frameState = useFrame({
    homeframeUrl: url,
    frameActionProxy: "/api/frames",
    frameGetProxy: "/api/frames",
    frameContext: fallbackFrameContext,
    connectedAddress: undefined,
    dangerousSkipSigning: false,
    signerState: {
      hasSigner: !isUndefined(signer),
      signer,
      onSignerlessFramePress: () => {
        alert("A frame button was pressed without a signer.");
      },
      signFrameAction: signFrameAction,
    },
  });

  const { status, frame } = frameState?.frame?.frame ?? {};
  const hasFrameError = status === "failure";
  if (hasFrameError) {
    return frame.ogImage ? <WarpcastImage url={frame.ogImage} /> : null;
  }
  return (
    <div className="w-72">
      <FrameUI frameState={frameState} FrameImage={FrameImageNext} />
    </div>
  );
};

export default FrameEmbed;
