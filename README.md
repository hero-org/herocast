![herocast_logo_wide](https://github.com/hero-org/.github/blob/main/assets/herocast-logo.png?raw=true)
<br />
[![build](https://github.com/hellno/herocast/actions/workflows/build.yaml/badge.svg)](https://github.com/hellno/herocast/actions/workflows/build.yaml)

[![Explore docs](https://deepwiki.com/badge.svg)](https://deepwiki.com/hero-org/herocast)

# herocast

herocast is Farcaster’s leading open source client. Our goal is to decentralize power on the internet, faster. While we develop herocast.xyz as a standalone product to help professionals get stuff done on-chain we invite you to use our open source codebase to contribute to the mission with your personal flavor.

## What is Farcaster?

a protocol for decentralized social apps: https://www.farcaster.xyz

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

## Contributing

[![GitHub repo Good Issues for newbies](https://img.shields.io/github/issues/hero-org/herocast/good%20first%20issue?style=flat&logo=github&logoColor=green&label=Good%20First%20issues)](https://github.com/hero-org/herocast/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22) [![GitHub Help Wanted issues](https://img.shields.io/github/issues/hero-org/herocast/help%20wanted?style=flat&logo=github&logoColor=b545d1&label=%22Help%20Wanted%22%20issues)](https://github.com/hero-org/herocast/issues?q=is%3Aopen+is%3Aissue+label%3A%22help+wanted%22) [![GitHub Help Wanted PRs](https://img.shields.io/github/issues-pr/hero-org/herocast/help%20wanted?style=flat&logo=github&logoColor=b545d1&label=%22Help%20Wanted%22%20PRs)](https://github.com/hero-org/herocast/pulls?q=is%3Aopen+is%3Aissue+label%3A%22help+wanted%22) [![GitHub repo Issues](https://img.shields.io/github/issues/hero-org/herocast?style=flat&logo=github&logoColor=red&label=Issues)](https://github.com/hero-org/herocast/issues?q=is%3Aopen)

👋 **Welcome, new contributors!**

Whether you're a seasoned developer or just getting started, your contributions are valuable to us. Don't hesitate to jump in, explore the project, and make an impact. To start contributing, please check out our [Contribution Guidelines](CONTRIBUTING.md).

## License

Distributed under the AGPLv3 License. See LICENSE for more information.

## Contact

hellno [Farcaster](https://farcaster.xyz/hellno.eth)

Website: https://herocast.xyz

GitHub: https://github.com/hero-org/herocast
