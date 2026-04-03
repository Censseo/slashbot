# Feature: Alephium Wallet Adapter

**Parent Idea**: [idea.md](../idea.md)
**Feature ID**: 02
**Priority**: P1/MVP
**Status**: Not Specified

## Summary

Implement the Alephium blockchain adapter using `@alephium/web3`, supporting wallet creation, ALPH native coin management, and custom fungible token operations. This adapter plugs into the multi-chain abstraction from Feature 01 to provide full Alephium wallet functionality.

## User Value

**Who benefits**: Users holding ALPH or Alephium-based tokens
**What they gain**: Manage Alephium funds directly within slashbot without external tools
**Success metric**: Users can create an Alephium wallet, check balances, and send ALPH/tokens successfully

## Scope

### This Feature Includes
- Alephium adapter implementing `BlockchainAdapter` interface
- Wallet creation with Alephium-compatible HD key derivation
- ALPH native coin balance queries via Alephium RPC
- ALPH native coin transfers
- Custom fungible token balance queries
- Custom fungible token transfers
- Alephium address validation
- Alephium explorer URL generation for transactions
- Encrypted storage of Alephium keypair (reusing AES-256-GCM from crypto.ts)
- Mnemonic seed phrase support for Alephium wallet import/export

### This Feature Does NOT Include
- Exchange rate / pricing display (Feature 03)
- Smart contract interactions beyond token transfers
- NFT support
- Proxy billing integration
- Multi-account HD wallet support

## Key Use Cases

### Use Case 1: Create Alephium Wallet
**Actor**: Slashbot user
**Goal**: Set up an Alephium wallet
**Flow**:
1. User runs `/wallet alph create`
2. System generates Alephium keypair from mnemonic
3. Encrypts and stores in `~/.slashbot/wallet-alph.json`
4. Displays public address and seed phrase for backup

### Use Case 2: Check Alephium Balances
**Actor**: User with Alephium wallet
**Goal**: See ALPH and token holdings
**Flow**:
1. User runs `/wallet alph balance`
2. System queries Alephium node for ALPH balance
3. System queries token contract for custom token balance
4. Displays both amounts (USD conversion handled by Feature 03)

### Use Case 3: Send ALPH
**Actor**: User with Alephium wallet
**Goal**: Transfer ALPH to another address
**Flow**:
1. User runs `/wallet alph send <address> 1.5`
2. System validates Alephium address format
3. Prompts for password / uses active session
4. Constructs UTXO transaction via `@alephium/web3`
5. Signs and submits transaction
6. Displays tx hash and Alephium explorer link

### Use Case 4: Import Existing Alephium Wallet
**Actor**: User with existing Alephium wallet elsewhere
**Goal**: Import their wallet into slashbot
**Flow**:
1. User runs `/wallet alph import`
2. System prompts for mnemonic seed phrase
3. Derives Alephium keypair from seed
4. Encrypts and stores wallet
5. Displays imported public address for verification

## Dependencies

### Requires
- Feature 01 (multi-chain-abstraction): `BlockchainAdapter` interface and `WalletManager` routing

### Enables
- Feature 03 (alephium-pricing): Provides balance data to display with USD conversion

## Technical Hints

### Required Commands/Scripts

| Order | Command/Script | Purpose |
|-------|----------------|---------|
| 1 | `bun add @alephium/web3` | Install Alephium SDK |
| 2 | `bun test` | Run tests |
| 3 | `bun run build` | Verify build |

### Required Tools & Versions

- **@alephium/web3**: latest - Core Alephium blockchain SDK (RPC, transactions, signing)
- **bip39**: ^3.1.0 (already installed) - Mnemonic generation (shared with Solana)

### Implementation Notes

- Alephium uses UTXO model -- balance = sum of unspent transaction outputs
- HD derivation path for Alephium: `m/44'/1234'/0'/0/0` (coin type 1234 for ALPH)
- Alephium uses Blake2b hashing (different from Solana's SHA-256)
- Token transfers on Alephium use built-in token support in the UTXO model (not separate contracts like SPL)
- `@alephium/web3` provides `NodeProvider` for RPC and `SignerProvider` for signing
- Need to verify Bun compatibility of `@alephium/web3` early -- this is a key risk
- Default Alephium mainnet RPC: `https://node.mainnet.alephium.org` (or configurable)
- Alephium addresses are Base58-encoded, similar format to Solana but different validation
- The custom token ID needs to be configurable (stored in constants or config)

## Open Questions

- What is the custom token contract/token ID on Alephium?
- Which Alephium RPC node to use? Public mainnet node or self-hosted?
- Does `@alephium/web3` work correctly under Bun runtime?
- What is the transaction fee structure on Alephium? (need to display to user before confirming)
- Should we support testnet for development/testing?

## Notes

The UTXO model is the biggest technical difference from Solana. Alephium's SDK should abstract most of this complexity, but edge cases around UTXO consolidation and dust limits may need handling. Test with small amounts on mainnet (or testnet if supported) before releasing.
