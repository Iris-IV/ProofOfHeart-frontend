# Security Vulnerability Disclosure Policy

This document outlines the process for reporting security vulnerabilities in **ProofOfHeart-frontend**, including response timelines and bounty rewards.

## Disclosure Process

1. **Reporting**: Submit issues to `security@proofofheart.irisiv.org` with:
   - Proof-of-concept (PoC) code (TypeScript/Node.js preferred)
   - Steps to reproduce
   - Affected versions (`package.json` snapshot)

2. **Triage**: Response within **72 hours** (excluding weekends/holidays).

3. **Resolution**: Fixes prioritized by severity. Public disclosure after patch release.

## Response Timeline

| Severity       | SLA (Max)       |
|----------------|----------------|
| Low            | 30 days         |
| Medium         | 14 days         |
| High/Critical  | 7 days          |

## Bounty Tiers

Rewards (in **USDC**) are paid after patch release and public disclosure.

| Severity       | Bounty Range   |
|----------------|----------------|
| Low            | $100–$500       |
| Medium         | $500–$2,000     |
| High           | $2,000–$5,000   |
| Critical       | $5,000+         |

### Example: Secure Dependency Update
```typescript
// Before (vulnerable)
const axios = require('axios');

// After (patched + audit)
import axios from 'axios';
axios.defaults.validateStatus = (status) => status < 500;
// Run: npm audit fix --force
```

## Reporting Guidelines

1. **Do not** disclose vulnerabilities publicly before coordination.
2. **Include** reproducible steps and environment details (`node -v`, `npm -v`).
3. **Use** encrypted channels for sensitive data.

## Compliance

This policy aligns with [GitHub’s Security Advisory Guidelines](https://docs.github.com/en/code-security/security-advisories) and [OWASP Top 10](https://owasp.org/www-project-top-ten/).