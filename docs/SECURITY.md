# Security Policy

This document outlines the security measures implemented in the ProofOfHeart frontend application.

## Table of Contents

1. [Content Security Policy (CSP)](#content-security-policy-csp)
2. [Security Headers](#security-headers)
3. [RPC Proxy](#rpc-proxy)
4. [Image Validation](#image-validation)
5. [Environment Variables](#environment-variables)
6. [Freighter Wallet Integration](#freighter-wallet-integration)

---

## Content Security Policy (CSP)

The application implements a strict Content Security Policy to prevent XSS attacks and data exfiltration.

### CSP Directives

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://*.freighter.app https://soroban-testnet.stellar.org https://mainnet.stellar.validationcloud.io https://*.stellar.org; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; manifest-src 'self'
```

### Key Directives Explained

- **`default-src 'self'`**: All resources default to same-origin only
- **`script-src 'self' 'unsafe-inline' 'unsafe-eval'`**: Allows inline scripts and eval (required for Freighter wallet signing)
- **`style-src 'self' 'unsafe-inline'`**: Allows inline styles
- **`img-src 'self' data: https: blob:`**: Allows images from same origin, data URLs, HTTPS, and blob URLs
- **`connect-src`**: Allows connections to:
  - Same origin
  - Freighter extension (`https://*.freighter.app`)
  - Soroban RPC endpoints (testnet and mainnet)
  - Stellar.org domains
- **`frame-ancestors 'none'`**: Prevents the app from being embedded in iframes (clickjacking protection)
- **`form-action 'self'`**: Form submissions only to same origin
- **`base-uri 'self'`**: Prevents base tag hijacking
- **`manifest-src 'self'`**: Web app manifest from same origin only

### Freighter Compatibility

The CSP is configured to work with the Freighter wallet extension:
- `script-src 'unsafe-inline' 'unsafe-eval'` allows Freighter's inline signing logic
- `connect-src https://*.freighter.app` allows communication with the Freighter extension
- Testing has confirmed that wallet signing works correctly under this CSP

---

## Security Headers

The following security headers are applied to all routes:

| Header | Value | Purpose |
|--------|-------|---------|
| `Content-Security-Policy` | See above | Prevents XSS and data injection |
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME type sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer information leakage |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` (production only) | Enforces HTTPS |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS protection |

---

## RPC Proxy

### Problem

Using `NEXT_PUBLIC_` environment variables exposes secrets to the browser bundle. Mainnet RPC URLs with API keys should never be committed or exposed to clients.

### Solution

A server-side RPC proxy at `/api/rpc` handles all RPC requests:

- **Server-side only**: The proxy uses `MAINNET_RPC_URL` and `TESTNET_RPC_URL` environment variables that are never exposed to the browser
- **Rate limiting**: 60 requests per minute per IP to prevent abuse
- **Network-aware**: Automatically routes to the correct RPC based on `NEXT_PUBLIC_STELLAR_NETWORK`

### Usage

Instead of calling RPC directly from the client:

```ts
// ❌ Don't do this (exposes API key to browser)
const response = await fetch('https://mainnet.stellar.validationcloud.io/v1/SECRET_KEY', {
  method: 'POST',
  body: JSON.stringify({ jsonrpc: '2.0', method: 'getHealth' }),
});
```

Use the proxy:

```ts
// ✅ Do this (API key stays server-side)
const response = await fetch('/api/rpc', {
  method: 'POST',
  body: JSON.stringify({ jsonrpc: '2.0', method: 'getHealth' }),
});
```

### Environment Variables

```env
# Server-side (never exposed to browser)
MAINNET_RPC_URL=https://mainnet.stellar.validationcloud.io/v1/<API_KEY>
TESTNET_RPC_URL=https://soroban-testnet.stellar.org

# Client-side (used to determine which network to use)
NEXT_PUBLIC_STELLAR_NETWORK=testnet
```

---

## Image Validation

### Problem

User-provided image URLs can be used for SSRF attacks or to display inappropriate content.

### Solution

Image validation is implemented in `src/lib/imageValidation.ts`:

- **Domain validation**: Only allows images from trusted domains:
  - IPFS gateways: `ipfs.io`, `cloudflare-ipfs.com`, `ipfs.dweb.link`
  - Arweave: `arweave.net`
  - GitHub: `raw.githubusercontent.com`
  - Imgur: `i.imgur.com` (legacy)
  - Unsplash: `images.unsplash.com` (placeholders)
- **Size validation**: 100 bytes minimum, 10MB maximum
- **Type validation**: Only allows JPEG, PNG, WebP, GIF, SVG

### Usage

```ts
import { validateImageUrl, isAllowedImageDomain } from '@/lib/imageValidation';

// Validate a URL before using it
const validation = validateImageUrl(userImageUrl);
if (!validation.valid) {
  showError(validation.error);
  return;
}

// Quick check for client-side validation
if (!isAllowedImageDomain(userImageUrl)) {
  showError('Image domain not allowed');
  return;
}
```

### Next.js Image Configuration

The `next.config.ts` has been updated to:
- Remove wildcard patterns (`**.ipfs.io` → `ipfs.io`)
- Constrain to specific hostnames only
- Document why `unoptimized: true` is set (standalone output requirement)

---

## Environment Variables

### Public Variables (Browser-Exposed)

Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. Never put secrets in these:

```env
NEXT_PUBLIC_USE_MOCKS=true
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_CONTRACT_ADDRESS=
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_ERROR_TRACKING_DSN=
```

### Server-Only Variables (Secret)

Variables without `NEXT_PUBLIC_` prefix are only available on the server:

```env
MAINNET_RPC_URL=https://mainnet.stellar.validationcloud.io/v1/<API_KEY>
TESTNET_RPC_URL=https://soroban-testnet.stellar.org
```

### Best Practices

1. Never commit `.env.local` - it's in `.gitignore`
2. Use `.env.example` to document required variables
3. Rotate API keys if they are ever leaked
4. Use platform-specific secret management (Vercel env vars, AWS Secrets Manager, etc.) for production

---

## Freighter Wallet Integration

### Security Considerations

- **No private keys**: The frontend never handles private keys. All signing is done by the Freighter extension.
- **User approval**: Every transaction requires explicit user approval in the Freighter UI.
- **Network mismatch detection**: The app detects when Freighter is on the wrong network and warns the user.

### CSP Compatibility

The CSP is configured to allow Freighter to function:
- `script-src 'unsafe-inline' 'unsafe-eval'` allows Freighter's signing logic
- `connect-src https://*.freighter.app` allows communication with the extension

### Testing

To verify Freighter works under CSP:
1. Build the app with CSP enabled (default in production)
2. Connect wallet
3. Attempt to sign a transaction (e.g., contribute to a campaign)
4. Confirm the Freighter popup appears and signing succeeds

---

## Additional Security Measures

### Error Tracking

Error tracking (e.g., Sentry) is configured to:
- Only send errors in production (`NODE_ENV === 'production'`)
- Scrub PII (wallet addresses, emails, private keys) before sending
- Capture transaction context (action, campaign id, error code) for debugging

### Cache Invalidation

React Query cache invalidation is scoped by campaign id to prevent over-invalidation and data leakage between users.

### Rate Limiting

The RPC proxy implements rate limiting (60 req/min per IP) to prevent abuse. In production, consider using Redis for distributed rate limiting.

---

## Security Checklist

- [x] Content Security Policy implemented
- [x] Security headers configured
- [x] RPC proxy for mainnet (API keys server-side)
- [x] Rate limiting on RPC proxy
- [x] Image domain validation
- [x] Image size/type validation
- [x] No committed API keys
- [x] Freighter CSP compatibility verified
- [x] Error tracking PII scrubbing
- [x] Scoped cache invalidation

---

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:

1. Do not create a public issue
2. Email the details to the project maintainers
3. Include steps to reproduce the vulnerability
4. Allow time for the issue to be fixed before disclosing publicly
