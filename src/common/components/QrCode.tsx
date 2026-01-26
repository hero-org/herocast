import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';
import QRCode from 'react-qr-code';
import ClickToCopyText from '@/common/components/ClickToCopyText';

export const QrCode = ({ deepLink }: { deepLink: string }) => {
  return (
    <div className="flex flex-col items-center">
      <div className="w-48 h-48">
        <QRCode value={deepLink} size={192} style={{ height: 'auto', maxWidth: '100%', width: '100%' }} />
      </div>
      <div className="mt-4 flex flex-col text-sm max-w-fit space-y-3">
        <span className="text-foreground text-center">Scan the QR code with your mobile camera app to sign in.</span>
        <details className="mx-auto">
          <summary className="cursor-pointer text-foreground/70 hover:text-foreground">
            Problems scanning QR code?
          </summary>
          <div className="mt-2 space-y-2">
            <a
              href={deepLink}
              target="_blank"
              rel="noreferrer"
              className="underline flex items-center text-foreground/70 hover:text-foreground"
            >
              Open this link in your Farcaster app
              <ArrowTopRightOnSquareIcon className="w-4 h-4 ml-1" />
            </a>
            <ClickToCopyText text={deepLink} />
          </div>
        </details>
      </div>
    </div>
  );
};
