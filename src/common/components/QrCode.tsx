import React from "react";
import QRCode from "react-qr-code";

export const QrCode = ({ deepLink }: { deepLink: string }) => {
  return <>
    <QRCode value={deepLink} />
    <span className="text-sm">Use this link if you're on mobile with Warpcast installed
      <a href="">{deepLink}</a>
    </span>
  </>
}
