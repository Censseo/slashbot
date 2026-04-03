# Idea: Multi-Chain Wallet Support (Alephium + Solana)

**Created**: 2026-02-12
**Status**: Exploration
**Short Name**: alephium-wallet

## Vision

Add Alephium as a second supported blockchain wallet alongside the existing Solana wallet, allowing users to manage funds on both chains simultaneously. Users interact with each chain via sub-commands (`/wallet solana ...`, `/wallet alph ...`), while the billing/proxy system remains on Solana.

## Problem Statement

### The Problem
Slashbot currently only supports Solana wallets. Users who hold ALPH or Alephium-based tokens have no way to manage those funds within slashbot, forcing them to use external tools.

### Current Situation
- Wallet functionality is tightly coupled to Solana (`@solana/web3.js`, SPL tokens, Solana-specific HD derivation)
- No abstraction layer exists between the wallet plugin and the blockchain implementation
- Commands assume a single chain (`/wallet balance`, `/wallet send`)

### Why Now?
Community interest in Alephium support, and the plugin architecture is mature enough to support multi-chain extension.

## Target Users

### Primary Users
- **Slashbot power users**: Existing users who also hold ALPH and want unified wallet management. Technically proficient, familiar with crypto wallets.

### Secondary Stakeholders
- **Bot operators**: Need to understand configuration for multi-chain support
- **Proxy/billing service**: Must continue to function on Solana without disruption

## Goals & Success Metrics

### Primary Goals
1. Users can create, unlock, and manage an Alephium wallet alongside their Solana wallet
2. Users can check balances (ALPH + custom token) with USD equivalences
3. Users can send ALPH and custom tokens to Alephium addresses

### Success Indicators
- Both wallets can coexist without interference
- Alephium operations (balance, send) work reliably
- Billing/proxy system continues to function on Solana unaffected
- Exchange rates display correctly for ALPH/USD and token/ALPH

### MVP Definition
- Alephium wallet creation/import/unlock/export
- ALPH native coin balance and transfers
- Custom fungible token balance and transfers
- ALPH/USD and token/ALPH pricing integration
- Sub-command structure: `/wallet solana ...`, `/wallet alph ...`

## Scope

### In Scope (MVP)
- Blockchain adapter abstraction layer (interface extracted from Solana code)
- Alephium wallet adapter (`@alephium/web3`)
- ALPH native coin operations (balance, send, receive)
- Custom fungible token operations on Alephium
- Exchange rate integration for ALPH/USD and token/ALPH
- Command restructuring to sub-command pattern (`/wallet <chain> <action>`)
- Encrypted wallet storage for Alephium keypair (reuse existing AES-256-GCM)
- Sidebar display for Alephium balances

### In Scope (Future)
- Alephium-based billing/proxy support
- Cross-chain swaps
- Multi-wallet per chain (HD wallet multiple accounts)

### Explicitly Out of Scope
- Changing the billing/proxy system (stays on Solana)
- Alephium smart contract interaction beyond token transfers
- EVM or other blockchain support (only Solana + Alephium)
- Alephium DeFi integrations
- NFT support on either chain

## Key Use Cases (Sketches)

### Use Case 1: Create an Alephium Wallet
**Actor**: Slashbot user
**Goal**: Set up an Alephium wallet to manage ALPH funds
**Flow**:
1. User runs `/wallet alph create`
2. System generates Alephium keypair, encrypts with user's password
3. Stores encrypted wallet in `~/.slashbot/wallet-alph.json`
4. Displays public address and backup seed phrase

### Use Case 2: Check Multi-Chain Balances
**Actor**: Slashbot user with both wallets
**Goal**: See balances across both chains
**Flow**:
1. User runs `/wallet balance` (no chain specified)
2. System displays Solana balances (SOL, SLASHBOT) AND Alephium balances (ALPH, custom token)
3. All amounts show USD equivalences

### Use Case 3: Send ALPH to Another Address
**Actor**: Slashbot user
**Goal**: Transfer ALPH to a friend
**Flow**:
1. User runs `/wallet alph send <address> <amount>`
2. System prompts for password (or uses active session)
3. Creates and submits Alephium transaction
4. Displays transaction hash and explorer link

### Use Case 4: Check Alephium Token Balance
**Actor**: Slashbot user
**Goal**: See custom token balance on Alephium
**Flow**:
1. User runs `/wallet alph balance`
2. System queries Alephium node for ALPH balance and token balance
3. Displays both with USD equivalences

## Constraints & Assumptions

### Known Constraints
- **Technical**: Alephium uses UTXO model (unlike Solana's account model) -- adapter must handle this difference
- **Technical**: Alephium SDK (`@alephium/web3`) has different API patterns than `@solana/web3.js`
- **Technical**: Alephium uses Blake2b hashing and different key derivation paths
- **Business**: Billing must remain on Solana -- no disruption to proxy revenue flow
- **Dependency**: Need a reliable ALPH/USD price feed API

### Assumptions
- The existing AES-256-GCM encryption layer works for Alephium keys (ed25519-based, similar to Solana)
- Alephium public RPC nodes are sufficiently reliable for the use case
- Users are comfortable managing two separate wallets with separate passwords (or same password, separate encrypted files)
- The `@alephium/web3` SDK is compatible with Bun runtime

## Features Overview

**Complexity Score**: 12/10 - Very Complex

### Feature Breakdown

| # | Feature | Description | Priority | Dependencies | Status |
|---|---------|-------------|----------|--------------|--------|
| 01 | multi-chain-abstraction | Extract blockchain-agnostic wallet interfaces and refactor command structure for sub-commands | P1/MVP | None | :black_square_button: Not specified |
| 02 | alephium-adapter | Implement Alephium blockchain adapter (wallet ops, ALPH + token transfers) | P1/MVP | 01 | :black_square_button: Not specified |
| 03 | alephium-pricing | Integrate ALPH/USD and token/ALPH exchange rate feeds and pricing display | P1/MVP | 02 | :black_square_button: Not specified |

**Status Legend**: :black_square_button: Not specified -> :pencil: Specified -> :white_check_mark: Implemented

### Feature Dependencies Graph

```text
[01-multi-chain-abstraction]
    └── [02-alephium-adapter]
            └── [03-alephium-pricing]
```

### Implementation Order

1. **Phase 1 (MVP)**: 01, 02, 03 (sequential due to dependencies)

## Open Questions & Risks

### Questions to Resolve
- What is the custom token contract ID on Alephium?
- Which Alephium RPC endpoint to use (public node? self-hosted?)
- What price feed API supports ALPH/USD? (CoinGecko? custom?)
- Should wallet passwords be shared between Solana and Alephium wallets, or independent?
- Does `@alephium/web3` run correctly under Bun? (needs testing)
- What is the BIP44 derivation path for Alephium? (`m/44'/1234'/0'/0/0`?)

### Identified Risks
- **Bun compatibility**: `@alephium/web3` may have Node.js-specific dependencies that don't work in Bun. Mitigation: test early, consider polyfills.
- **UTXO complexity**: Alephium's UTXO model requires different transaction construction logic than Solana's account model. Mitigation: lean heavily on the SDK's transaction builder.
- **Price feed reliability**: ALPH may have less liquid/reliable price feeds than SOL. Mitigation: graceful degradation if price unavailable.
- **Refactoring scope**: Extracting the abstraction layer from tightly-coupled Solana code could introduce regressions. Mitigation: thorough testing of existing Solana wallet after refactor.

## Discovery Notes

### Session 2026-02-12
- Q: Proxy billing support for Alephium? -> A: No, billing stays on Solana. Alephium is for fund management only.
- Q: Token support on Alephium? -> A: ALPH native coin + custom fungible token.
- Q: One wallet or both active? -> A: Both wallets active in parallel.
- Q: Pricing for ALPH? -> A: Yes, ALPH/USD and token/ALPH exchange rates needed.
- Q: Command structure? -> A: Sub-commands: `/wallet solana balance`, `/wallet alph send ...`

## Technical Hints

### Required Commands/Scripts

| Order | Command/Script | Purpose |
|-------|----------------|---------|
| 1 | `bun add @alephium/web3` | Install Alephium SDK |
| 2 | `bun test` | Run tests after refactoring |
| 3 | `bun run build` | Verify build after changes |

### Required Tools & Versions

- **@alephium/web3**: latest - Alephium blockchain interaction SDK
- **@alephium/web3** token utilities (if separate package) - Fungible token operations

### Integration Sequences

1. Alephium full node RPC API for balance queries and transaction submission
2. Price feed API (CoinGecko or similar) for ALPH/USD rates
3. Alephium explorer for transaction links

### Implementation Notes

- Reuse `src/plugins/wallet/services/crypto.ts` for AES-256-GCM encryption (blockchain-agnostic)
- Alephium uses different HD key derivation path than Solana (`m/44'/1234'/...` vs `m/44'/501'/...`)
- UTXO model means balance = sum of unspent outputs, not a single account balance
- Token transfers on Alephium use a different mechanism than Solana SPL tokens
- The `ProxyAuthProvider` must remain untouched -- only Solana wallet signs proxy requests
- Command parser in `commands.ts` (49KB) will need significant restructuring for sub-command pattern
