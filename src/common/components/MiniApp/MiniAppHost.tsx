'use client';

import type { Context, Manifest, MiniAppHost as MiniAppHostSDK } from '@farcaster/miniapp-host';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createSiweMessage } from 'viem/siwe';
import { useAccount, useWalletClient } from 'wagmi';
import { cn } from '@/lib/utils';
import { useAccountStore } from '@/stores/useAccountStore';
import { exposeToIframeWithMultipleOrigins } from './exposeToIframeMultiOrigin';
import { MiniAppSplash } from './MiniAppSplash';
import { getAllowedOrigins, isValidHttpsUrl, sanitizeIframeSrc, sanitizeManifest } from './security';

export interface MiniAppHostProps {
  url: string;
  manifest?: Partial<Manifest.MiniAppConfig>;
  className?: string;
}

const MiniAppHost: React.FC<MiniAppHostProps> = ({ url, manifest, className }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Get current Farcaster account
  const { accounts, selectedAccountIdx } = useAccountStore();
  const currentAccount = accounts?.[selectedAccountIdx];

  // Get wallet client for Ethereum provider
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();

  // Sanitize manifest data to prevent XSS
  const safeManifest = useMemo(() => sanitizeManifest(manifest), [manifest]);

  // Validate and sanitize the iframe source URL
  const safeSrc = useMemo(() => {
    const candidateUrl = safeManifest?.homeUrl || url;
    return sanitizeIframeSrc(candidateUrl);
  }, [safeManifest, url]);

  // Get validated origins for postMessage communication
  // Include both www and non-www variants to handle redirects
  const miniAppOrigins = useMemo(() => {
    if (!safeSrc) return [];
    return getAllowedOrigins(safeSrc);
  }, [safeSrc]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Validate URL before proceeding
    if (!safeSrc || !miniAppOrigins || miniAppOrigins.length === 0) {
      setError('Invalid or insecure mini app URL. Only HTTPS URLs are allowed.');
      return;
    }

    // Build the context for the mini app
    const context: Context.MiniAppContext = {
      client: {
        platformType: 'web',
        clientFid: currentAccount?.platformAccountId ? parseInt(currentAccount.platformAccountId) : 0,
        added: false,
      },
      user: {
        fid: currentAccount?.platformAccountId ? parseInt(currentAccount.platformAccountId) : 0,
        username: currentAccount?.user?.username,
        displayName: currentAccount?.user?.display_name,
        pfpUrl: currentAccount?.user?.pfp_url,
      },
      location: {
        type: 'launcher',
      },
      features: {
        haptics: false,
        cameraAndMicrophoneAccess: false,
      },
    };

    // Create SDK implementation with minimal required callbacks
    const sdk: Omit<MiniAppHostSDK, 'ethProviderRequestV2'> = {
      context,

      // Required: App signals ready
      ready: async () => {
        setIsReady(true);
      },

      // Required: Close the mini app
      close: () => {
        console.log('Mini app requested close');
        // Parent component should handle this
      },

      // Required: Open URL - validate before opening
      openUrl: (targetUrl: string) => {
        // Only allow http/https URLs to prevent javascript: and other dangerous protocols
        if (!isValidHttpsUrl(targetUrl)) {
          console.warn('Mini app attempted to open invalid URL:', targetUrl);
          return;
        }
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      },

      // Required: Set primary button
      setPrimaryButton: (options) => {
        console.log('Set primary button:', options);
        // TODO: Implement primary button in host UI
      },

      // Required: Get capabilities
      getCapabilities: async () => {
        return [
          'actions.ready',
          'actions.close',
          'actions.openUrl',
          'actions.setPrimaryButton',
          'actions.signIn',
          'wallet.getEthereumProvider',
        ];
      },

      // Required: Get supported chains
      getChains: async () => {
        return ['eip155:1', 'eip155:8453', 'eip155:10']; // Ethereum, Base, Optimism
      },

      // Ethereum provider request (legacy)
      ethProviderRequest: async () => {
        throw new Error('Use ethProviderRequestV2 instead');
      },

      // EIP-6963 provider announcement
      eip6963RequestProvider: () => {
        console.log('EIP-6963 provider requested');
        // TODO: Implement if needed
      },

      // Sign in with Farcaster (SIWF) - follows EIP-4361 format
      signIn: async (options: {
        nonce: string;
        notBefore?: string;
        expirationTime?: string;
        acceptAuthAddress?: boolean;
      }) => {
        const debug = process.env.NODE_ENV === 'development';
        if (debug) {
          console.log('signIn:request', {
            nonce: options.nonce,
            acceptAuthAddress: options.acceptAuthAddress,
            hasAccount: !!currentAccount,
            hasWallet: !!walletClient,
            address,
          });
        }

        // Validate nonce
        if (!options.nonce || options.nonce.length < 8) {
          throw new Error('Invalid nonce: must be at least 8 characters');
        }

        // Check if we have a Farcaster account
        if (!currentAccount?.platformAccountId) {
          throw new Error('No Farcaster account connected');
        }

        // Check if wallet is connected
        if (!address || !walletClient) {
          throw new Error('No wallet connected. Please connect your wallet first.');
        }

        const fid = parseInt(currentAccount.platformAccountId);
        const miniAppUrl = safeSrc || url;
        const parsedUrl = new URL(miniAppUrl);

        // Build SIWF message using viem for proper EIP-4361 formatting
        // https://docs.farcaster.xyz/developers/siwf/
        // Chain ID 10 = Optimism (used by Farcaster protocol)
        const now = new Date();
        const expirationTime = options.expirationTime
          ? new Date(options.expirationTime)
          : new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes default

        const message = createSiweMessage({
          domain: parsedUrl.host,
          address: address,
          statement: 'Farcaster Connect',
          uri: miniAppUrl,
          version: '1',
          chainId: 10, // Optimism - required by Farcaster
          nonce: options.nonce,
          issuedAt: now,
          expirationTime,
          notBefore: options.notBefore ? new Date(options.notBefore) : undefined,
          resources: [`farcaster://fid/${fid}`],
        });

        if (debug) {
          console.log('signIn:message', message);
        }

        try {
          // Request signature from user's wallet
          const signature = await walletClient.signMessage({
            account: address,
            message: message,
          });

          if (debug) {
            console.log('signIn:signature', signature);
          }

          // Return with custody authMethod - the connected wallet should be
          // the user's custody address or an auth address linked to their FID
          return {
            signature,
            message,
            authMethod: 'custody' as const,
          };
        } catch (e: any) {
          if (debug) {
            console.log('signIn:error', e);
          }
          // User rejected or wallet error
          if (e?.name === 'UserRejectedRequestError' || e?.code === 4001) {
            throw new Error('RejectedByUser');
          }
          throw e;
        }
      },

      // Sign manifest
      signManifest: async () => {
        throw new Error('Sign manifest not implemented');
      },

      // Add mini app
      addFrame: async () => {
        throw new Error('Add frame not implemented');
      },

      addMiniApp: async () => {
        throw new Error('Add mini app not implemented');
      },

      // View actions
      viewCast: async () => {
        console.log('View cast requested');
      },

      viewProfile: async () => {
        console.log('View profile requested');
      },

      viewToken: async () => {
        console.log('View token requested');
      },

      // Token actions
      sendToken: async () => {
        throw new Error('Send token not implemented');
      },

      swapToken: async () => {
        throw new Error('Swap token not implemented');
      },

      // Open mini app
      openMiniApp: async () => {
        console.log('Open mini app requested');
      },

      // Compose cast
      composeCast: async () => {
        throw new Error('Compose cast not implemented');
      },

      // Camera/microphone access
      requestCameraAndMicrophoneAccess: async () => {
        throw new Error('Camera/microphone access not implemented');
      },

      // Haptics
      impactOccurred: async () => {
        // No-op on web
      },

      notificationOccurred: async () => {
        // No-op on web
      },

      selectionChanged: async () => {
        // No-op on web
      },

      // Back navigation
      updateBackState: async () => {
        console.log('Update back state requested');
      },
    };

    // Get Ethereum provider from wallet client
    const ethProvider = walletClient ? (walletClient.transport as any) : undefined;

    // Expose SDK to iframe with multiple allowed origins to handle redirects
    try {
      const { cleanup } = exposeToIframeWithMultipleOrigins({
        iframe,
        sdk,
        allowedOrigins: miniAppOrigins,
        ethProvider,
        debug: process.env.NODE_ENV === 'development',
      });

      cleanupRef.current = cleanup;
    } catch (e) {
      console.error('Failed to expose SDK to iframe:', e);
      setError('Failed to initialize mini app');
    }

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [safeSrc, miniAppOrigins, currentAccount, walletClient, address]);

  // Safe title for the iframe (HTML escaped)
  const safeTitle = safeManifest?.name || 'Farcaster Mini App';

  return (
    <div className={cn('relative w-full h-full min-h-[695px] flex items-center justify-center', className)}>
      {/* Splash screen - uses sanitized manifest data */}
      {!isReady && !error && (
        <MiniAppSplash
          name={safeManifest?.name}
          iconUrl={safeManifest?.iconUrl}
          splashImageUrl={safeManifest?.splashImageUrl}
          splashBackgroundColor={safeManifest?.splashBackgroundColor}
        />
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background">
          <div className="text-center space-y-4">
            <p className="text-destructive font-semibold">Failed to load mini app</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {/* Mini app iframe - only render if we have a valid source */}
      {safeSrc && (
        <div
          className="relative w-full h-full"
          style={{ aspectRatio: '424 / 695', maxWidth: '100%', maxHeight: '100%' }}
        >
          <iframe
            ref={iframeRef}
            src={safeSrc}
            className={cn('w-full h-full border-0 rounded-lg', !isReady && 'opacity-0')}
            style={{
              minWidth: '424px',
              minHeight: '695px',
            }}
            // Permissions Policy - explicitly restrict powerful APIs
            // Only allow clipboard-write which mini apps may need for copy functionality
            allow="clipboard-write"
            // Sandbox: Required for mini apps to function
            // - allow-scripts: Required for JS execution
            // - allow-same-origin: Required for mini app to make authenticated requests to its backend
            //   NOTE: This is safe because the iframe is CROSS-ORIGIN to herocast.
            //   The iframe can only access ITS OWN origin's cookies/storage, not herocast's.
            // - allow-forms: Required for form submissions
            // - allow-popups: Required for wallet connections (they open popups)
            // - allow-modals: Allow alert/confirm/prompt (some apps use these)
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            // Referrer policy - limit information sent to mini app
            referrerPolicy="strict-origin-when-cross-origin"
            // Prevent the iframe from navigating the top-level window
            // Note: This is implicit in sandbox without allow-top-navigation
            title={safeTitle}
          />
        </div>
      )}
    </div>
  );
};

export default MiniAppHost;
export { MiniAppHost };
