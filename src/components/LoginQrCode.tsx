import React from "react";
import QRCode from "react-qr-code";

export const LoginQrCode = ({ deepLink }: { deepLink: string }) => {
  return <>
    <QRCode value={deepLink} />
    <p className="text-gray-100">Sign-in with Farcaster</p>
  </>
}
