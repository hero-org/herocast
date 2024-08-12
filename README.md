![herocast_logo_wide](https://github.com/hero-org/.github/blob/main/assets/herocast-logo.png?raw=true)  
<br />
[![build](https://github.com/hellno/herocast/actions/workflows/build.yaml/badge.svg)](https://github.com/hellno/herocast/actions/workflows/build.yaml)

# herocast

herocast is Farcaster’s leading open source client. Our goal is to decentralize power on the internet, faster. While we develop herocast.xyz as a standalone product to help professionals get stuff done on-chain we invite you to use our open source codebase to contribute to the mission with your personal flavor.

## What is Farcaster?

a protocol for decentralized social apps: https://www.farcaster.xyz

## Partners

<p>
  <a href="https://www.hatsprotocol.xyz/">
    <img alt="hats protocol logo" src="https://raw.githubusercontent.com/hero-org/.github/main/assets/hats_protocol.avif" width="auto" height="50"/>
  </a>
  <a href="https://paywithglide.xyz">
    <img alt="glide logo" src="https://github.com/hero-org/.github/blob/main/assets/glide.png?raw=true" width="auto" height="50" />
  </a>
  <a href="https://www.bountycaster.xyz/">
    <img alt="Bountycaster logo" src="https://github.com/hero-org/.github/blob/main/assets/Bountycaster.png?raw=true" width="auto" height="50"/ >
  </a>
  <a href="https://launchcaster.xyz/">
    <img alt="Launchcaster logo" src="https://github.com/hero-org/.github/blob/main/assets/Launchcaster.png?raw=true" width="auto" height="50" />
  </a>
   <a href="https://warpcast.com/remindme">
    <img alt="Launchcaster logo" src="https://github.com/hero-org/.github/blob/main/assets/remindmebot.png?raw=true" width="auto" height="50" />
  </a>
 </p>

#### Troubleshooting local DB errors

```psql
GRANT
EXECUTE
  ON FUNCTION pgsodium.crypto_aead_det_encrypt (bytea, bytea, bytea, bytea) TO authenticated;

GRANT
EXECUTE
  ON FUNCTION pgsodium.crypto_aead_det_encrypt (bytea, bytea, uuid, bytea) TO authenticated;

GRANT
EXECUTE
  ON FUNCTION pgsodium.crypto_aead_det_decrypt (bytea, bytea, bytea, bytea) TO authenticated;

GRANT
EXECUTE
  ON FUNCTION pgsodium.crypto_aead_det_decrypt (bytea, bytea, uuid, bytea) TO authenticated;

GRANT
  pgsodium_keyiduser TO authenticated;
```

## License

Distributed under the AGPLv3 License. See LICENSE for more information.

## Contact

hellno [Warpcast](https://warpcast.com/hellno.eth)

Website: https://herocast.xyz

Github: https://github.com/hellno/herocast
