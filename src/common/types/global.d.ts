declare global {
  interface Window {
    ethereum: import('ethers').providers.ExternalProvider;
    __linkify_plugins_registered?: boolean;
  }
}

export {};
