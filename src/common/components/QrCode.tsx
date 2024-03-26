import React from "react";
import QRCode from "react-qr-code";
import { openWindow } from "@/common/helpers/navigation";

export const QrCode = ({ deepLink }: { deepLink: string }) => {
  return <div className="mt-2">
    <QRCode value={deepLink} />
    <p className="mt-4 flex flex-col text-sm max-w-fit">
      <span className="text-foreground/70">Use this link if you&apos;re on mobile with Warpcast installed</span>
      <span className="cursor-pointer" onClick={() => openWindow(deepLink)}>{deepLink}</span>
    </p>
  </div>
}
