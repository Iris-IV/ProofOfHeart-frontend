# Security Vulnerability Disclosure Policy

This document outlines the process for reporting security vulnerabilities in **ProofOfHeart-frontend** and the associated bug bounty program.

---

## Reporting a Vulnerability

1. **Do not** publicly disclose vulnerabilities until they are resolved.
2. Send a detailed report to **security@proofofheart.iris** with:
   - Steps to reproduce
   - Affected codebase version
   - Proof-of-concept (if applicable)

### Response Timeline
| Stage               | SLA       |
|---------------------|-----------|
| Initial Acknowledgment | <24h      |
| Triage & Validation  | <72h      |
| Fix & Patch Release  | <14d      |

---

## Bug Bounty Guidelines

ProofOfHeart rewards responsible disclosures. Payouts are distributed in **USDC** via Base/EVM.

### Reward Tiers
| Severity          | Criteria                                                                 | Reward Range  |
|--------------------|---------------------------------------------------------------------------|---------------|
| **Low**            | Minor impact, no data exposure                                      | $100 - $500    |
| **Medium**          | Partial data exposure or DoS                                        | $500 - $2,000  |
| **High**            | Full data exposure or critical functionality compromise             | $2,000 - $10,000|
| **Critical**        | Remote code execution, private key leakage, or system compromise    | $10,000+       |

### Eligibility
- Reports must be **original** and **unpublished**.
- Submitters must comply with the [Responsible Disclosure Policy](#reporting-a-vulnerability).
- Payouts are taxable; submitters must provide KYC if requested.

---

## Verification Steps

To validate a reported issue, run the following in the `ProofOfHeart-frontend` repo:

```bash
# Install dependencies
pnpm install

# Run affected component in isolation
pnpm dev -- --port 3001

# Test with a PoC (replace with your exploit)
echo '{"test":"exploit"}' | curl -X POST http://localhost:3001/api/endpoint
```

Verify the response matches the expected behavior documented in [`src/api/endpoints.ts`](src/api/endpoints.ts).

---

## Scope

**In Scope:**
- Frontend codebase (`src/`)
- API endpoints (`/api/`)
- Smart contract interactions (`/contracts/`)

**Out of Scope:**
- Third-party libraries (report to their maintainers)
- Physical security issues

---

## Legal

By participating in this program, you agree to:
1. Not violate applicable laws.
2. Not disrupt ProofOfHeart services.
3. Grant ProofOfHeart a perpetual license to reproduce reports.

Last updated: 2024-02-15