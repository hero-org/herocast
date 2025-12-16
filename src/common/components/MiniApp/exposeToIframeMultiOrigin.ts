/**
 * Extended version of @farcaster/miniapp-host's exposeToIframe that accepts multiple allowed origins.
 *
 * This is necessary to handle URL redirects (e.g., www vs non-www) where the iframe might
 * load from a different origin than initially specified.
 *
 * We copy the implementation from the SDK and modify it to pass an array of origins
 * to Comlink.expose() instead of a single origin.
 */

import * as Comlink from '@farcaster/miniapp-host/dist/comlink/index.js';
import type { MiniAppHost } from '@farcaster/miniapp-core';
import type { Provider } from 'ox/Provider';

/**
 * Create an iframe endpoint that can post messages to multiple target origins
 */
function createIframeEndpointMultiOrigin({
  iframe,
  targetOrigins,
  debug = false,
}: {
  iframe: HTMLIFrameElement;
  targetOrigins: string[];
  debug?: boolean;
}) {
  // Use the first origin as the primary target for outgoing messages
  const primaryOrigin = targetOrigins[0];

  return {
    // windowEndpoint from Comlink
    postMessage: (msg: any, transferables?: Transferable[]) => {
      iframe.contentWindow?.postMessage(msg, primaryOrigin, transferables);
    },
    addEventListener: globalThis.addEventListener.bind(globalThis),
    removeEventListener: globalThis.removeEventListener.bind(globalThis),

    // Additional methods from SDK
    emit: (event: any) => {
      if (debug) {
        console.debug('frameEvent', event);
      }
      const wireEvent = {
        type: 'frameEvent',
        event,
      };
      iframe.contentWindow?.postMessage(wireEvent, primaryOrigin);
    },
    emitEthProvider: (event: any, params: any) => {
      if (debug) {
        console.debug('fc:emitEthProvider', event, params);
      }
      const wireEvent = {
        type: 'frameEthProviderEvent',
        event,
        params,
      };
      iframe.contentWindow?.postMessage(wireEvent, primaryOrigin);
    },
  };
}

/**
 * Helper to wrap SDK handlers to match wire protocol format
 * The wire protocol expects { result: ... } or { error: { type: ... } } format
 */
function wrapHandlers(sdk: Omit<MiniAppHost, 'ethProviderRequestV2'>) {
  return {
    ...sdk,
    // signIn needs special wrapping for wire protocol
    signIn: async (options: any) => {
      try {
        const result = await sdk.signIn(options);
        // Wrap successful result
        return { result };
      } catch (e: any) {
        // Check for user rejection
        if (e?.message === 'RejectedByUser' || e?.message?.includes('rejected')) {
          return {
            error: {
              type: 'rejected_by_user',
            },
          };
        }
        // Re-throw other errors
        throw e;
      }
    },
  };
}

/**
 * Helper to wrap Ethereum provider request (from helpers/ethereumProvider.js)
 */
function wrapEthereumProviderRequest({ provider, debug }: { provider: Provider; debug?: boolean }) {
  return async (params: any) => {
    if (debug) {
      console.debug('fc:ethProviderRequestV2', params);
    }
    // Forward the request to the provider
    return provider.request(params);
  };
}

/**
 * Check if provider supports EIP-1193 event methods
 */
function isEIP1193Provider(provider: any): provider is Provider & {
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener: (event: string, listener: (...args: unknown[]) => void) => void;
} {
  return (
    provider &&
    typeof provider === 'object' &&
    typeof provider.on === 'function' &&
    typeof provider.removeListener === 'function'
  );
}

/**
 * Helper to forward Ethereum provider events (from helpers/ethereumProvider.js)
 * Only sets up event forwarding if the provider supports EIP-1193 events
 */
function forwardEthereumProviderEvents({
  provider,
  endpoint,
  debug,
}: {
  provider: any;
  endpoint: any;
  debug?: boolean;
}): (() => void) | undefined {
  // Check if provider supports event methods
  if (!isEIP1193Provider(provider)) {
    if (debug) {
      console.debug('Provider does not support EIP-1193 events, skipping event forwarding');
    }
    return undefined;
  }

  // Common Ethereum provider events
  const events = ['accountsChanged', 'chainChanged', 'connect', 'disconnect', 'message'];

  const listeners: Array<{ event: string; listener: (...args: any[]) => void }> = [];

  events.forEach((eventName) => {
    const listener = (...args: any[]) => {
      endpoint.emitEthProvider(eventName, args);
    };
    try {
      provider.on(eventName as any, listener);
      listeners.push({ event: eventName, listener });
    } catch (e) {
      if (debug) {
        console.debug(`Failed to attach listener for ${eventName}:`, e);
      }
    }
  });

  // Return cleanup function
  return () => {
    listeners.forEach(({ event, listener }) => {
      try {
        provider.removeListener(event as any, listener);
      } catch (e) {
        // Ignore cleanup errors
      }
    });
  };
}

/**
 * Expose SDK to iframe with support for multiple allowed origins.
 *
 * This is a modified version of exposeToIframe from @farcaster/miniapp-host
 * that accepts an array of allowed origins instead of a single origin.
 */
export function exposeToIframeWithMultipleOrigins({
  iframe,
  sdk,
  allowedOrigins,
  ethProvider,
  debug = false,
}: {
  iframe: HTMLIFrameElement;
  sdk: Omit<MiniAppHost, 'ethProviderRequestV2'>;
  allowedOrigins: string[];
  ethProvider?: Provider;
  debug?: boolean;
}): {
  endpoint: any;
  cleanup: () => void;
} {
  if (!allowedOrigins || allowedOrigins.length === 0) {
    throw new Error('At least one allowed origin must be specified');
  }

  const endpoint = createIframeEndpointMultiOrigin({
    iframe,
    targetOrigins: allowedOrigins,
    debug,
  });

  const extendedSdk: any = wrapHandlers(sdk);

  let providerCleanup: (() => void) | undefined;

  if (ethProvider) {
    // Add the ethProviderRequestV2 handler if provider supports request method
    if (typeof ethProvider.request === 'function') {
      extendedSdk.ethProviderRequestV2 = wrapEthereumProviderRequest({
        provider: ethProvider,
        debug,
      });
    }
    // Forward provider events if supported
    providerCleanup = forwardEthereumProviderEvents({ provider: ethProvider, endpoint, debug });
  }

  // This is the key change: pass allowedOrigins array instead of single origin
  const unexpose = Comlink.expose(extendedSdk, endpoint, allowedOrigins);

  const cleanup = () => {
    providerCleanup?.();
    unexpose();
  };

  return {
    endpoint,
    cleanup,
  };
}
