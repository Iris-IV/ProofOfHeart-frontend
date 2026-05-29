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
| **Runtime**    | Node.js (v20+)                                 |

## 🏗 Architecture

The project follows the standard **Next.js App Router** architecture:

- `src/app/`: Contains the routes, layouts, and page-specific logic.
- `src/components/`: (Planned) Reusable UI components.
- `src/hooks/`: (Planned) Custom React hooks for state and API interaction.
- `src/utils/`: (Planned) Utility functions and constants.
- `public/`: Static assets like images and fonts.

## ✨ Current Frontend Features

- Campaign exploration and detail pages backed by the Soroban contract service layer.
- Wallet-aware creator and contributor actions including withdrawal, refunds, and admin verification.
- Wallet dashboard contribution history with per-campaign status, claimable refund/revenue actions, and Stellar explorer transaction links.
- Revenue sharing support for eligible Educational Startup campaigns:
  creator dashboard deposit flow, contributor claim flow, revenue pool display, and transparent pro-rata breakdowns.
- Admin dashboard at `/admin` with wallet-gated access, pending campaign verification, platform fee updates, admin transfer, and contract-level stats.
- Revenue sharing support for eligible Educational Startup campaigns:
  creator dashboard deposit flow, contributor claim flow, revenue pool display, and transparent pro-rata breakdowns.
- Admin dashboard at `/admin` with wallet-gated access, pending campaign verification, platform fee updates, admin transfer, and contract-level stats.

## ✨ Current Frontend Features

- Campaign exploration and detail pages backed by the Soroban contract service layer.
- Wallet-aware creator and contributor actions including withdrawal, refunds, and admin verification.
- Platform fee transparency across contribution, withdrawal, and cause detail views, with a 3% fallback until the `get_platform_fee` getter is available on-chain.
- Wallet dashboard contribution history with per-campaign status, claimable refund/revenue actions, and Stellar explorer transaction links.
- Revenue sharing support for eligible Educational Startup campaigns:
  creator dashboard deposit flow, contributor claim flow, revenue pool display, and transparent pro-rata breakdowns.
- Admin dashboard at `/admin` with wallet-gated access, pending campaign verification, platform fee updates, admin transfer, and contract-level stats.

## 🏁 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (Version 20 or higher)
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

## ⚙️ Configuration

The project uses environment variables for configuration. Create a `.env.local` file in the root directory:

```env
# Example Environment Variables
NEXT_PUBLIC_API_URL=https://api.proofofheart.org
# NEXT_PUBLIC_CHAIN_ID=1
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
# Optional off-chain webhook for creator email opt-ins
NEXT_PUBLIC_CREATOR_EMAIL_WEBHOOK_URL=
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

## 🤝 Contributing!

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
</ErrorBoundary>
```

Only `error.name`, `error.message`, and `error.stack` are forwarded — no user data or wallet addresses are included by default.

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

Built with ❤️ by the ProofOfHeart Community.
