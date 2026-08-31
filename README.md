# ProofOfHeart

**A decentralized launchpad where the community — not a corporation — validates a cause.**

ProofOfHeart empowers everyday people to rally behind the causes they believe in. By leveraging blockchain transparency and community-driven governance, it removes gatekeepers from the fundraising process and puts trust back where it belongs: in the hands of the people.

## 🌟 Vision & Mission

- **Vision**: A world where any meaningful cause can receive support without needing permission from a centralized authority.
- **Mission**: To build an open, transparent launchpad that lets communities discover, validate, and fund causes through decentralized consensus — ensuring that every voice counts and every contribution is accounted for on-chain.

## 🚀 Core Principles

- **Community First**: Causes are validated by the people, not by a corporate board.
- **Radical Transparency**: Every decision and transaction lives on-chain for anyone to verify.
- **Permissionless Participation**: Anyone can propose, support, or challenge a cause.
- **Trust Through Code**: Smart contracts enforce the rules, removing the need for intermediaries.

## 🛠 Tech Stack

| Layer          | Technology                                     |
| -------------- | ---------------------------------------------- |
| **Framework**  | [Next.js 16](https://nextjs.org/) (App Router) |
| **Language**   | [TypeScript](https://www.typescriptlang.org/)  |
| **Styling**    | [Tailwind CSS v4](https://tailwindcss.com/)    |
| **Animations** | [Framer Motion](https://motion.dev/)           |
| **Linting**    | [ESLint 9](https://eslint.org/)                |
| **Runtime**    | Node.js (v22+)                                 |

## 🏗 Architecture

The project follows the standard **Next.js App Router** architecture:

- `src/app/`: Contains the routes, layouts, and page-specific logic.
- `src/components/`: (Planned) Reusable UI components.
- `src/hooks/`: (Planned) Custom React hooks for state and API interaction.
- `src/utils/`: (Planned) Utility functions and constants.
- `public/`: Static assets like images and fonts.

## ✨ Current Frontend Features.

- Campaign exploration and detail pages backed by the Soroban contract service layer.
- Wallet-aware creator and contributor actions including withdrawal, refunds, and admin verification.
- Platform fee transparency across contribution, withdrawal, and cause detail views, with a 3% fallback until the `get_platform_fee` getter is available on-chain.
- Wallet dashboard contribution history with per-campaign status, claimable refund/revenue actions, and Stellar explorer transaction links.
- Revenue sharing support for eligible Educational Startup campaigns:
  creator dashboard deposit flow, contributor claim flow, revenue pool display, and transparent pro-rata breakdowns.
- Admin dashboard at `/admin` with wallet-gated access, pending campaign verification, platform fee updates, admin transfer, and contract-level stats.

## 🏁 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (Version 22 or higher)
- [npm](https://www.npmjs.com/)

### Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/Iris-IV/ProofOfHeart-frontend.git
    cd ProofOfHeart-frontend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

### Local Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🔧 Developing Without a Live Network

The app includes a mock-data development mode that allows you to develop and test the UI without connecting to a live Stellar testnet. This is useful for frontend development, UI testing, and running the test suite locally.

### Enabling Mock Mode

Set the `NEXT_PUBLIC_USE_MOCKS` environment variable to `true` in your `.env.local` file:

```env
NEXT_PUBLIC_USE_MOCKS=true
```

When enabled, the app uses mock campaign data instead of fetching from the blockchain. The mock data is defined in `src/lib/contractClient.ts` and is gated behind the `IS_MOCK_MODE` runtime check.

**Important**: The build process will fail if you attempt to build a production bundle with `NEXT_PUBLIC_USE_MOCKS=true`. This is intentional to prevent accidental deployment of mock data to production. See [issue #343](https://github.com/Iris-IV/ProofOfHeart-frontend/issues/343) for details.

### Using the DevMockPanel UI

When mock mode is enabled in development, a **DevMockPanel** component appears as a floating button in the bottom-right corner of the screen (labeled "⚙️ Mock"). Click it to open the mock scenario panel.

The panel allows you to:

- **Switch campaign states** for campaigns 1-6 using dropdown selectors
- **Test different UI states** without changing mock data files
- **Persist scenarios** across page reloads (stored in sessionStorage)
- **Reset all scenarios** to default with one click

#### Available Mock Scenarios

Each campaign can be set to one of the following scenarios:

- **Default**: Original mock data from `contractClient.ts`
- **Active**: Ongoing campaign, 50% funded, not verified
- **Verified**: Verified campaign, 33% funded, funds not yet withdrawn
- **Funded**: Successfully funded campaign, funds withdrawn, deadline passed
- **Cancelled**: Campaign cancelled by creator, 25% funded
- **Failed**: Deadline passed, goal not met (20% funded)
- **Empty**: No data (empty title, description, zero amounts)
- **Error**: Error state for testing error boundaries and loading states

### Adding a New Mock Scenario

To add a new mock scenario:

1. **Add the scenario type** to the `MockScenario` type in `src/hooks/useDevMockScenario.ts`:

```typescript
export type MockScenario =
  | "default"
  | "active"
  // ... existing scenarios
  | "your_new_scenario"; // Add here
```

2. **Implement the scenario logic** in `src/lib/devMockScenarios.ts` by adding a new case in the `applyMockScenario` function:

```typescript
case "your_new_scenario":
  return {
    ...campaign,
    // Set your desired campaign properties
    is_active: true,
    status: "active" as CampaignStatus,
  };
```

3. **Add the scenario to the UI** in `src/components/DevMockPanel.tsx` by adding an `<option>` to the select dropdown:

```tsx
<option value="your_new_scenario">Your New Scenario</option>
```

4. **Add to the scenarios list** in `src/lib/devMockScenarios.ts` by updating `MOCK_SCENARIOS`:

```typescript
export const MOCK_SCENARIOS = [
  // ... existing scenarios
  { value: "your_new_scenario", label: "Your New Scenario", description: "Description" },
] as const;
```

### Mock Data Files

- **`src/lib/contractClient.ts`**: Contains the base mock campaign data
- **`src/lib/devMockScenarios.ts`**: Scenario transformation logic
- **`src/hooks/useDevMockScenario.ts`**: React hook for accessing current scenario
- **`src/components/DevMockPanel.tsx`**: Dev-only UI for switching scenarios
- **`src/lib/mockCauses.ts`**: Filter constants for listing pages

## ⚙️ Configuration

The project uses environment variables for configuration. Create a `.env.local` file in the root directory:

```env
# Example Environment Variables
NEXT_PUBLIC_API_URL=https://api.proofofheart.org
# NEXT_PUBLIC_CHAIN_ID=1
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
# Optional server-side webhook for creator email opt-ins (used by /api/email-opt-in)
CREATOR_EMAIL_WEBHOOK_URL=
```

`NEXT_PUBLIC_API_URL` is the base URL for the off-chain service layer used by campaign comments, updates, reports, and wallet transaction history.

Expected endpoints under that base URL:

- `GET /campaigns/:campaignId/updates`
- `POST /campaigns/:campaignId/updates`
- `GET /campaigns/:campaignId/comments`
- `POST /campaigns/:campaignId/comments`
- `POST /campaigns/:campaignId/comments/:commentId/pin`
- `POST /campaigns/:campaignId/comments/:commentId/report`
- `POST /campaign-reports`
- `PATCH /campaign-reports`
- `POST /wallet-transactions`

Authenticated off-chain mutations send wallet signatures with:

- `X-Wallet-Address`
- `X-Request-Signature`
- `X-Request-Timestamp`
- `X-Request-Purpose`

The client retries transient failures and falls back to the existing mock/local stores when `NEXT_PUBLIC_API_URL` is not set.

#### Feature Flags

The project uses a simple feature flag system to gate in-progress features. Flags are controlled by `NEXT_PUBLIC_FEATURE_*` environment variables and default to `false` (disabled) in production.

| Feature   | Environment Variable            | Default | Purpose                                             |
| --------- | ------------------------------- | ------- | --------------------------------------------------- |
| votingUI  | `NEXT_PUBLIC_FEATURE_VOTINGUI`  | `false` | Enables the voting UI on cause detail pages         |
| analytics | `NEXT_PUBLIC_FEATURE_ANALYTICS` | `false` | Enables analytics event tracking                    |
| embeds    | `NEXT_PUBLIC_FEATURE_EMBEDS`    | `false` | Enables embedded content (e.g. social media embeds) |

> **Note on caching:** Feature flags are read once at module initialization and cached for the lifetime of the process. Changing environment variables during development will not take effect until the dev server is restarted. See [issue #559](https://github.com/Iris-IV/ProofOfHeart-frontend/issues/559) for details.

## 🚀 Mainnet Launch Checklist

Before going live on the Stellar public network, ensure the following production-readiness items are complete:

### Smart Contract

- [ ] `get_platform_fee` getter deployed on mainnet (remove the 3% hardcoded fallback)
- [ ] Contract address and network passphrase updated to mainnet values in `.env.production`
- [ ] Full audit of Soroban contract completed and findings addressed
- [ ] Emergency pause / admin-transfer mechanisms tested on mainnet

### Frontend

- [ ] `NEXT_PUBLIC_NETWORK_PASSPHRASE` set to `Public Global Stellar Network ; September 2015`
- [ ] `NEXT_PUBLIC_RPC_URL` pointed at a production Horizon / Soroban RPC endpoint
- [ ] `NEXT_PUBLIC_API_URL` pointed at the production off-chain service
- [ ] Error boundary wired to a production error tracker (e.g. Sentry)
- [ ] All console warnings and TypeScript errors resolved (`npm run build` passes cleanly)
- [ ] Lighthouse / Core Web Vitals baseline captured

### Security & Operations

- [ ] Content Security Policy (CSP) headers configured for production
- [ ] Rate limiting enabled on off-chain API endpoints
- [ ] Secrets rotated; no `.env.local` values committed to the repository
- [ ] Docker production image built and smoke-tested (`docker build` + `docker run`)
- [ ] CI pipeline passes on `main` (lint → build → tests)

### Communications

- [ ] Community announcement drafted
- [ ] Docs/README updated with mainnet contract address and explorer links

## 🤝 Contributing!

Please review our [Security Policy](SECURITY.md) for information on how to responsibly disclose vulnerabilities.

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

We welcome contributions! To maintain a clean and consistent codebase, please follow these guidelines:

1.  **Fork the repository** and create your branch from `main`.
2.  **Naming Convention**: Use descriptive branch names (e.g., `feat/add-onboarding`, `fix/login-error`).
3.  **Code Style**:
    - Use Functional Components with Hooks.
    - Follow the existing TypeScript patterns.
    - Run `npm run lint` before committing.
4.  **Pull Requests**:
    - Provide a clear description of the changes.
    - Reference any related issues.
    - Ensure your code builds locally (`npm run build`).

### Internationalization (i18n)

To keep our translation files clean, you can run the unused keys script to find keys that exist in the English messages file but are no longer referenced in the source code:

```bash
node scripts/find-unused-i18n-keys.js
```

This script will output a report of keys present in `messages/en.json` but never referenced in `src/`.

## 🐳 Docker Support

To ensure a consistent development environment, we support containerization with Docker.

### Local Development

Run the following command to start the application in development mode with hot-reloading:

```bash
docker-compose up
```

### Production Build

To build the production image manually:

```bash
docker build -t proofofheart-frontend .
```

To run the production container:

```bash
docker run -p 3000:3000 proofofheart-frontend
```

## 📊 Observability

The application includes an internal observability module for monitoring contract interactions, transaction flows, and RPC operations. See [docs/observability.md](docs/observability.md) for architecture details, event types, and instructions on adding new observability events.

## 🛡 Error Reporting

`src/components/ErrorBoundary.tsx` exposes an optional `onError` prop that receives a PII-safe error report (`name`, `message`, `stack`) whenever a React render error is caught.

### Wiring Sentry (or another provider)

1. Install the SDK: `npm install @sentry/nextjs`
2. Follow the [Sentry Next.js setup guide](https://docs.sentry.io/platforms/javascript/guides/nextjs/) to create `sentry.client.config.ts`.
3. Pass `onError` wherever you render `<ErrorBoundary>`:

```tsx
import * as Sentry from "@sentry/nextjs";
import ErrorBoundary from "@/components/ErrorBoundary";

<ErrorBoundary
  onError={({ name, message, stack }) =>
    Sentry.captureException(Object.assign(new Error(message), { name, stack }))
  }
>
  {children}
</ErrorBoundary>;
```

Only `error.name`, `error.message`, and `error.stack` are forwarded — no user data or wallet addresses are included by default.

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

Built with ❤️ by the ProofOfHeart Community.
