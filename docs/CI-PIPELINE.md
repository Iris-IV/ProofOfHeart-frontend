# CI Pipeline Documentation

## Overview

The CI pipeline runs on every push to `main` and on pull requests. It ensures code quality, security, and performance standards.

## Pipeline Stages

### 1. Dependencies & Setup
- Checkout code
- Setup Node.js 22
- Install dependencies with npm ci

### 2. Code Quality Checks
- **Linting**: ESLint checks code style and patterns
- **Type Checking**: TypeScript compilation without emitting files
- **Testing**: Jest unit and integration tests with coverage reporting
- **Coverage**: Uploads to Codecov for tracking

### 3. Security Audits
- **NPM Audit (CI)**: Runs `npm run audit:ci` to check for package vulnerabilities
  - Only checks production dependencies (dev dependencies are excluded)
  - Uses audit-ci configuration for known vulnerability allowlisting
  - Fails the build if critical or high-severity vulnerabilities are found

### 4. Build & Performance
- **Production Build**: Creates Next.js production build
- **Lighthouse CI**: Runs Lighthouse audits (3 runs)
  - **Performance Score**: Must be ≥90 (REQUIRED)
  - **Accessibility Score**: Monitored (target ≥90)
  - Uploads artifacts to temporary public storage for review

### 5. Cleanup
- Stops development server
- Removes temporary files

## Performance Requirements

### Lighthouse Score Thresholds

| Metric | Threshold | Status |
|--------|-----------|--------|
| Performance | ≥90 | 🚫 REQUIRED (fails build if below) |
| Accessibility | ≥90 | ⚠️ MONITORED (warning if below) |

## Audit Configuration

The `audit-ci.json` file configures security audit behavior:

```json
{
  "package-manager": "npm",
  "critical": true,
  "high": true,
  "moderate": false,
  "skip-dev": true,
  "retry-count": 3
}
```

**Key Settings:**
- Only checks critical and high-severity vulnerabilities
- Skips dev-only dependencies
- Retries up to 3 times on transient failures
- Allowlist known vulnerabilities with documented expiry dates

## Running Locally

### Full CI Simulation

```bash
# Install dependencies
npm ci

# Run all checks
npm run lint
npm run typecheck
npm run test:coverage
npm run audit:ci
npm run build
```

### Performance Testing

```bash
# Build and run server
npm run build
npm run start

# In another terminal, audit with Lighthouse
# Manual: Open http://localhost:3000 in Chrome and run Lighthouse
# Or use lighthouse-ci CLI
```

## Debugging CI Failures

### Performance Score Below 90
1. Check the Lighthouse artifacts uploaded in the CI run
2. Identify bottlenecks (LCP, FID, CLS, etc.)
3. Profile with Chrome DevTools locally
4. Optimize images, code splitting, and critical resources

### Audit Failures
1. Run `npm run audit:full` to see all vulnerabilities
2. Check if the vulnerability is in the allowlist
3. If not allowlisted:
   - Update dependencies: `npm update`
   - Or add to allowlist with expiry and rationale
4. Document the decision in `audit-ci.json`

### Test Coverage
1. Run `npm run test:coverage` locally
2. Check coverage reports in `coverage/` directory
3. Add tests for uncovered code paths

## Continuous Improvement

Regularly review and update:
- Performance budgets as features are added
- Accessibility targets
- Security vulnerability allowlist (update expiry dates)
- Dependency versions
