# Feature: CAIP-based On-chain Discussion Threads in herocast

## Summary

Enable users to start conversations about on-chain entities (contracts, transactions, NFTs, events) by using [CAIP (Chain Agnostic Improvement Proposals)](https://github.com/ChainAgnostic/CAIPs) identifiers as FIP-2 `parentUrl` values. This creates discussion threads anchored to specific blockchain artifacts.

## Background

### Farcaster FIP-2

[FIP-2](https://github.com/farcasterxyz/protocol/discussions/71) allows casts to reply to arbitrary strings via `parentUrl`. This is how channels work today (e.g., `https://farcaster.group/dev`), but the same mechanism can anchor discussions to on-chain entities.

### Relevant CAIP Standards

| CAIP | Purpose | Format | Example |
|------|---------|--------|---------|
| **CAIP-2** | Chain ID | `namespace:reference` | `eip155:1` (Ethereum), `eip155:8453` (Base) |
| **CAIP-10** | Account/Address | `chain_id:address` | `eip155:1:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| **CAIP-19** | Asset Type/ID | `chain_id/asset_ns:ref[/token_id]` | `eip155:1/erc721:0x06012.../771769` |
| **CAIP-373** | Contract Calls | `account_id:call:function_data[:block]` | `eip155:1:0xA0b8...:call:0x18160ddd` |

**Note:** There is no official CAIP for transactions yet. Community convention uses CAIP-10 pattern with tx hash replacing address.

### Proposed `parentUrl` Format

```
# Contract discussion
caip10:eip155:1:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48

# NFT discussion
caip19:eip155:1/erc721:0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D/1234

# Token discussion
caip19:eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# Transaction discussion (unofficial but follows pattern)
caip-tx:eip155:1:0x4593e7f275383e76708718ead8f7226a804bea47fc9061ff649d105e943323e3
```

---

## UX Design

### Entry Points

Following [herocast UX guidelines](../ux-guidelines.md), this feature should be:
- **Keyboard-first**: Accessible via command palette
- **Low-friction**: Parse URLs users already copy
- **Transparent**: Show what they're posting about

### 1. Paste Explorer URLs (Primary Flow)

Users already copy links from Etherscan, Basescan, Zapper. Parse these automatically.

**Supported URL patterns:**

```
# Etherscan / Basescan / etc.
https://etherscan.io/address/0x...
https://etherscan.io/tx/0x...
https://etherscan.io/token/0x...
https://etherscan.io/nft/0x.../1234
https://basescan.org/address/0x...
https://basescan.org/tx/0x...

# Zapper
https://zapper.xyz/account/0x...
https://zapper.xyz/nft/ethereum/0x.../1234
```

**UX Flow:**

```
┌────────────────────────────────────────────────────────────────┐
│  New Cast                                                   [×] │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────┐  Start a discussion about...                           │
│  │ 🧑 │                                                         │
│  └────┘  [Paste explorer link or enter address]                │
│          ────────────────────────────────────                  │
│          https://basescan.org/tx/0x4593e7f27...                │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  📦 Transaction on Base                                   │  │
│  │  ───────────────────────────                              │  │
│  │  From: vitalik.eth → 0x742d...                           │  │
│  │  Value: 0.5 ETH                                          │  │
│  │  Status: ✅ Confirmed                                     │  │
│  │  Block: 12,345,678                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Write your thoughts about this transaction...                  │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│  [📷] [😊]             ○ 280   │  [Cast to Thread]             │
└────────────────────────────────────────────────────────────────┘
```

### 2. Recent Transactions Picker

Show transactions from user's verified addresses for quick selection.

**Data source:** User's `verified_addresses.eth_addresses` from their Farcaster profile (already displayed in `AuthorContextPanel.tsx`).

**UX Flow:**

```
┌────────────────────────────────────────────────────────────────┐
│  Start discussion about on-chain activity                  [×] │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  YOUR RECENT TRANSACTIONS                                       │
│  ─────────────────────────                                      │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ↗️ Sent 0.5 ETH                            2 hours ago   │  │
│  │  To: 0x742d35Cc6634C0532925a3b8...                        │  │
│  │  Base · Confirmed                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  🔄 Swap on Uniswap                         5 hours ago   │  │
│  │  1,000 USDC → 0.42 ETH                                    │  │
│  │  Ethereum · Confirmed                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  🎨 Minted NFT                              Yesterday     │  │
│  │  Based Punks #4521                                        │  │
│  │  Base · Confirmed                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  Or paste an explorer link...                                   │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### 3. Command Palette Integration

Add commands to `Cmd+K` palette:

```
┌─────────────────────────────────────────────┐
│ 🔍 discuss contract...                      │
├─────────────────────────────────────────────┤
│ On-chain                                    │
│   📦 Discuss a transaction                  │
│   📄 Discuss a contract                     │
│   🎨 Discuss an NFT                         │
│   🪙 Discuss a token                        │
└─────────────────────────────────────────────┘
```

### 4. Input Validation & Feedback

**Immediate feedback on paste:**

| Input | Feedback |
|-------|----------|
| Valid Etherscan URL | ✅ Shows parsed entity preview |
| Valid address (0x...) | ✅ Shows address with chain picker |
| Invalid URL | ⚠️ "Couldn't parse this link. Try pasting an Etherscan URL." |
| Unsupported chain | ⚠️ "Chain not supported yet" |

### 5. Feed Display

When viewing casts with CAIP `parentUrl`:

```
┌────────────────────────────────────────────────────────────────┐
│  Discussing: 📄 USDC Contract on Ethereum                      │
│  ──────────────────────────────────────────                    │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ [Avatar] vitalik.eth · @vitalik · 2h                   │    │
│  │                                                         │    │
│  │ This contract has processed over $1T in transfers.     │    │
│  │ Incredible to see stablecoin adoption.                 │    │
│  │                                                         │    │
│  │ 💬 12   🔄 5   ❤️ 42                                    │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ [Avatar] jessepollak · @jessepollak · 1h               │    │
│  │                                                         │    │
│  │ Native USDC on Base coming soon 👀                     │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## Technical Architecture

### URL Parsing Module

Create `src/common/helpers/caip.ts`:

```typescript
// Types
type CAIPType = 'address' | 'transaction' | 'token' | 'nft';

interface ParsedCAIP {
  type: CAIPType;
  chainId: string;        // e.g., "eip155:1"
  chainName: string;      // e.g., "Ethereum"
  identifier: string;     // address, tx hash, or token ID
  contractAddress?: string;
  tokenId?: string;
  caipUrl: string;        // Full CAIP URL for parentUrl
}

// Parser functions
function parseExplorerUrl(url: string): ParsedCAIP | null;
function parseZapperUrl(url: string): ParsedCAIP | null;
function parseRawAddress(address: string, chainId?: string): ParsedCAIP | null;

// CAIP URL generators
function toCAIP10(chainId: string, address: string): string;
function toCAIP19(chainId: string, assetNs: string, contractAddress: string, tokenId?: string): string;
function toCAIPTx(chainId: string, txHash: string): string;
```

### Chain Registry

```typescript
// src/common/constants/chains.ts
const SUPPORTED_CHAINS = {
  'eip155:1': {
    name: 'Ethereum',
    explorer: 'etherscan.io',
    rpc: 'https://eth.llamarpc.com',
  },
  'eip155:8453': {
    name: 'Base',
    explorer: 'basescan.org',
    rpc: 'https://mainnet.base.org',
  },
  'eip155:10': {
    name: 'Optimism',
    explorer: 'optimistic.etherscan.io',
    rpc: 'https://mainnet.optimism.io',
  },
  // Add more chains as needed
};
```

### Transaction Fetching

```typescript
// src/common/helpers/onchain.ts
interface TransactionSummary {
  hash: string;
  chainId: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  type: 'transfer' | 'swap' | 'mint' | 'contract_call';
  tokenTransfers?: TokenTransfer[];
}

// Fetch recent transactions for addresses
async function getRecentTransactions(
  addresses: string[],
  chains: string[]
): Promise<TransactionSummary[]>;
```

**Data sources (in order of preference):**
1. **Alchemy/Infura APIs** - Most reliable, requires API key
2. **Zapper API** - Good for multi-chain aggregation
3. **Direct RPC** - For transaction details
4. **Etherscan API** - Free tier available

### Existing Code Integration Points

| File | Integration |
|------|-------------|
| `src/common/components/Embeds/OnchainEmbed.tsx` | Enhance to render CAIP previews |
| `src/common/components/Embeds/index.tsx` | Add CAIP URL detection (line 37 already has `chain:` prefix) |
| `src/common/components/Sidebar/AuthorContextPanel.tsx` | Source for user's verified addresses |
| `src/stores/useDraftStore.ts` | `parentUrl` already supported |
| `src/common/hooks/useCastEditor.ts` | Add CAIP context handling |

### New Components

```
src/common/components/
├── Onchain/
│   ├── CAIPInput.tsx              # URL paste / address input
│   ├── CAIPPreview.tsx            # Rich preview of on-chain entity
│   ├── RecentTransactionsPicker.tsx
│   ├── ChainSelector.tsx          # For raw address input
│   └── OnchainThreadHeader.tsx    # Feed header for CAIP threads
```

---

## Implementation Phases

### Phase 1: URL Parsing & Basic Preview
- [ ] Create CAIP parsing utilities
- [ ] Support Etherscan/Basescan URL parsing
- [ ] Basic `OnchainEmbed` preview component
- [ ] Store CAIP as `parentUrl` in drafts

### Phase 2: Composer Integration
- [ ] Add "Discuss on-chain" option to composer
- [ ] URL paste detection in editor
- [ ] Rich preview in composer
- [ ] Command palette commands

### Phase 3: Transaction Picker
- [ ] Fetch transactions for verified addresses
- [ ] Recent transactions UI
- [ ] Transaction type detection (transfer, swap, mint)

### Phase 4: Feed Integration
- [ ] Thread header for CAIP discussions
- [ ] Discovery feed for on-chain discussions
- [ ] Search integration

---

## Open Questions

1. **Chain selection for raw addresses**: When user pastes just `0x...`, how do we know which chain? Options:
   - Default to Ethereum, allow override
   - Show chain picker
   - Check all supported chains for activity

2. **Transaction fetching rate limits**: How to handle API rate limits for transaction history?
   - Cache aggressively
   - Use user's own RPC/API keys
   - Limit to recent transactions only

3. **Event log references**: Should we support CAIP for specific contract events?
   - e.g., `caip-event:eip155:1:0x.../Transfer/0x...`
   - More complex but useful for smart contract devs

4. **Cross-client compatibility**: Other Farcaster clients won't recognize CAIP URLs. How to handle?
   - Include human-readable text in cast body
   - Embed link to explorer as fallback

---

## References

### CAIP Standards
- [CAIP-2: Chain ID](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md)
- [CAIP-10: Account ID](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-10.md)
- [CAIP-19: Asset ID](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-19.md)
- [CAIP-373: Contract Calls](https://chainagnostic.org/CAIPs/caip-373)

### Farcaster
- [FIP-2: Flexible targets](https://github.com/farcasterxyz/protocol/discussions/71)
- [Farcaster Channels](https://docs.farcaster.xyz/learn/what-is-farcaster/channels)

### herocast
- [UX Guidelines](../ux-guidelines.md)
- [UX Patterns Research](../ux-patterns-research.md)
- [Composer PRD](../PRD-composer-redesign.md)

### Existing Code
- `src/common/components/Embeds/OnchainEmbed.tsx` - Current on-chain embed (basic)
- `src/common/components/Sidebar/AuthorContextPanel.tsx` - Verified addresses display
- `src/common/components/EnsLookupLabel.tsx` - ENS resolution
- `src/stores/useDraftStore.ts` - Draft with parentUrl support

---

## Success Metrics

1. **Adoption**: Number of casts with CAIP `parentUrl`
2. **Engagement**: Reply rate on CAIP threads vs. regular casts
3. **Completion rate**: % of users who start CAIP flow and publish
4. **Error rate**: Failed parses / total paste attempts
