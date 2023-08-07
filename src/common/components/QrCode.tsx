import React from "react";
import QRCode from "react-qr-code";

export const QrCode = ({ deepLink }: { deepLink: string }) => {
  return <>
    <QRCode value={deepLink} />
  </>
}
