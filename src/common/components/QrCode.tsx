import React from "react";
import QRCode from "react-qr-code";
import ClickToCopyText from "@/common/components/ClickToCopyText";

export const QrCode = ({ deepLink }: { deepLink: string }) => {
  return (
    <div className="mt-2">
      <QRCode value={deepLink} />
      <div className="mt-4 flex flex-col text-md max-w-fit">
        <span className="text-foreground/70 space-y-4">
          Problems scanning QR code? Open this link in your Warpcast app:{" "}
          <a
            href={deepLink}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            {deepLink}
          </a>
          <ClickToCopyText text={deepLink} />
        </span>
      </div>
    </div>
  );
};
