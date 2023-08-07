import type * as app from '@tauri-apps/api/app';

declare global {
  interface Window {
    ethereum: import('ethers').providers.ExternalProvider;
  }
  interface Window {
    __TAURI__: {
      app?: typeof app;
      // ... the other tauri modules
    };
  }
}
