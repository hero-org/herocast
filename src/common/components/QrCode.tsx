import React from "react";
import QRCode from "react-qr-code";
import { openWindow } from "@/common/helpers/navigation";

export const QrCode = ({ deepLink }: { deepLink: string }) => {
  return <>
    <QRCode value={deepLink} />
    <p className="mt-4 flex flex-col text-sm text-gray-100 max-w-fit">
      <span>Use this link if you&apos;re on mobile with Warpcast installed</span>
      <span className="cursor-pointer rounded-sm py-1.5 px-2 bg-gray-700 mt-2" onClick={() => openWindow(deepLink)}>{deepLink}</span>
    </p>
  </>
}
