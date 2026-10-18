import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Proof of Heart",
  description: "Privacy Policy covering wallet addresses and analytics for Proof of Heart.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-4xl font-bold mb-6">Privacy Policy</h1>
      <p className="text-gray-500 mb-8">Last updated: {new Date().toLocaleDateString()}</p>

      <div className="prose prose-slate max-w-none">
        <h2>1. Overview</h2>
        <p>
          At Proof of Heart, we prioritize your privacy. As an on-chain, non-custodial platform, we
          minimize the data we collect. This Privacy Policy outlines how we handle data related to
          wallet addresses, analytics, and off-chain stores.
        </p>

        <h2>2. Data We Collect</h2>
        <h3>a. Public Blockchain Data</h3>
        <p>
          We interact with the Stellar blockchain. Your public wallet address, transaction history,
          and interactions with our smart contracts are public by nature and not controlled by us.
          We use this public data to render the user interface and track campaign progress.
        </p>

        <h3>b. Analytics and Off-Chain Data</h3>
        <p>
          We may collect anonymous usage data to improve our platform (e.g., page views, button
          clicks). This data does not personally identify you. Any off-chain data (such as campaign
          descriptions stored in IPFS or centralized databases) is retained as long as the campaign
          is active.
        </p>

        <h2>3. Data Retention</h2>
        <p>
          Public blockchain data is permanent. Off-chain analytics data is retained for up to 12
          months for product improvement purposes. Campaign metadata is retained indefinitely to
          maintain historical records of fundraising.
        </p>

        <h2>4. Third-Party Services</h2>
        <p>
          We use external RPC providers and analytics tools. These third parties have their own
          privacy policies. We do not share personally identifiable information with them.
        </p>
      </div>
    </div>
  );
}
