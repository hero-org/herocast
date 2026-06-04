// On Cloudflare Workers, a .wasm import resolves to a precompiled WebAssembly.Module.
declare module '*.wasm' {
  const mod: WebAssembly.Module;
  export default mod;
}
