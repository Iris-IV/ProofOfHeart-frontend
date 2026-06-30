import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Proof of Heart",
  description: "Terms of Service for the Proof of Heart fundraising platform.",
};

export default function TermsOfServicePage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-4xl font-bold mb-6">Terms of Service</h1>
      <p className="text-gray-500 mb-8">Last updated: {new Date().toLocaleDateString()}</p>

      <div className="prose prose-slate max-w-none">
        <h2>1. Introduction</h2>
        <p>
          Welcome to Proof of Heart. By accessing or using our non-custodial, on-chain fundraising
          platform, you agree to comply with and be bound by these Terms of Service.
        </p>

        <h2>2. Non-Custodial Nature</h2>
        <p>
          Proof of Heart is a non-custodial platform. We do not hold, manage, or have access to your
          private keys or the funds transacted on the platform. All transactions occur directly on
          the Stellar blockchain via smart contracts. You are solely responsible for the security of
          your wallet and funds.
        </p>

        <h2>3. Smart Contracts</h2>
        <p>
          Interactions with the platform involve executing smart contracts on the blockchain. While
          we strive to ensure the security and reliability of our contracts, blockchain technology
          involves inherent risks. We are not liable for any losses resulting from contract
          vulnerabilities or network failures.
        </p>

        <h2>4. User Responsibilities</h2>
        <p>
          You agree to use the platform in compliance with all applicable laws and regulations. You
          must not use the platform for any illegal activities, including but not limited to money
          laundering, fraud, or financing illicit acts.
        </p>

        <h2>5. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, Proof of Heart and its contributors shall not be
          liable for any direct, indirect, incidental, or consequential damages arising out of your
          use of or inability to use the platform.
        </p>
      </div>
    </div>
  );
}
