# Deployment Environments

This document defines the environment configuration matrix for ProofOfHeart deployments.

## Environment Matrix

### Staging (Testnet)

**Purpose:** Pre-production testing and validation

**Configuration:**

- Network: Stellar Testnet
- Network Passphrase: `Test SDF Network ; September 2015`
- RPC URL: `https://soroban-testnet.stellar.org`
- Mock Mode: `false` (use real contract)
- Contract Address: Testnet contract address
- Explorer: https://stellar.expert/explorer/testnet

**Environment Variables:**

```bash
NEXT_PUBLIC_USE_MOCKS=false
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_CONTRACT_ADDRESS=<testnet-contract-address>
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
```

### Production (Mainnet)

**Purpose:** Live production environment

**Configuration:**

- Network: Stellar Mainnet (Public)
- Network Passphrase: `Public Global Stellar Network ; September 2015`
- RPC URL: `https://soroban-mainnet.stellar.org` or custom RPC
- Mock Mode: `false` (enforced by build validation)
- Contract Address: Mainnet contract address
- Explorer: https://stellar.expert/explorer/public

**Environment Variables:**

```bash
NEXT_PUBLIC_USE_MOCKS=false
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-mainnet.stellar.org
NEXT_PUBLIC_CONTRACT_ADDRESS=<mainnet-contract-address>
NEXT_PUBLIC_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
```

## Secrets Management

### Staging Secrets

Store in your deployment platform's staging environment:

- `NEXT_PUBLIC_CONTRACT_ADDRESS` (testnet)
- `NEXT_PUBLIC_CREATOR_EMAIL_WEBHOOK_URL` (optional)
- `NEXT_PUBLIC_ERROR_TRACKING_DSN` (optional, staging instance)

### Production Secrets

Store in your deployment platform's production environment:

- `NEXT_PUBLIC_CONTRACT_ADDRESS` (mainnet)
- `NEXT_PUBLIC_CREATOR_EMAIL_WEBHOOK_URL` (optional)
- `NEXT_PUBLIC_ERROR_TRACKING_DSN` (production instance)

**Security Notes:**

- Never commit real contract addresses or API keys to version control
- Use separate error tracking projects for staging and production
- Rotate webhook URLs if compromised
- Validate network passphrase matches contract deployment network

## Promotion Process

### Staging to Production

1. **Deploy to Staging**
   - Merge feature branch to `main`
   - Automatic deployment to staging environment
   - Verify functionality on testnet

2. **Testing on Staging**
   - Run smoke tests
   - Verify contract interactions
   - Check explorer links point to testnet
   - Validate analytics events

3. **Production Deployment**
   - Tag release: `git tag v1.x.x`
   - Push tag: `git push origin v1.x.x`
   - Automatic deployment to production
   - Verify mainnet configuration

4. **Post-Deployment Validation**
   - Check explorer links point to mainnet
   - Verify contract address is correct
   - Monitor error tracking
   - Validate analytics funnel

## Network Detection

The application automatically detects the network from `NEXT_PUBLIC_NETWORK_PASSPHRASE`:

- Contains "test" → Testnet
- Otherwise → Mainnet (Public)

This ensures explorer links, network badges, and other network-specific features work correctly.

## Build Validation

The build process validates production configuration:

- Mock mode must be disabled in production builds
- Network passphrase must be set
- Contract address must be provided

See `scripts/validate-production-build.mjs` for validation logic.
