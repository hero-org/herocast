import React from "react";
import QRCode from "react-qr-code";
import ClickToCopyText from "@/common/components/ClickToCopyText";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/20/solid";

export const QrCode = ({ deepLink }: { deepLink: string }) => {
    return (
        <>
            <QRCode value={deepLink} />
            <div className="mt-4 flex flex-col text-md max-w-fit space-y-4">
                <span className="text-foreground">Scan the QR code with your mobile camera app to sign in.</span>
                <span className="flex flex-col mx-auto max-w-xs text-foreground/70 space-y-2">
                    Problems scanning QR code? <br />
                    <a href={deepLink} target="_blank" rel="noreferrer" className="underline flex items-center">
                        Open this link in your Warpcast app
                        <ArrowTopRightOnSquareIcon className="w-4 h-4 ml-1" />
                    </a>
                    <ClickToCopyText text={deepLink} />
                </span>
            </div>
        </>
    );
};
