import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import MultiSigWithdrawalPanel from "../../components/MultiSigWithdrawalPanel";
import { useMultiSigProposals } from "../../hooks/useMultiSigProposals";

// Mock next-intl hooks
jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, args?: any) => {
    const translations: Record<string, any> = {
      title: "Multi-sig Withdrawal",
      description: "Set up a multi-sig withdrawal proposal",
      setupProposal: "Setup Proposal",
      createProposal: "Create Proposal",
      cancel: "Cancel",
      signProposal: "Sign Proposal",
      executeWithdrawal: (args: any) => `Execute Withdrawal (${args?.amount})`,
      signing: "Signing...",
      confirming: "Confirming...",
      processing: "Processing...",
      proposalCreated: "Proposal created",
      errorNoSigners: "No signers provided",
      errorInvalidThreshold: "Invalid threshold",
      statusReady: "Ready",
      statusPending: "Pending",
      cancelProposal: "Cancel Proposal",
      viewOnExplorer: "View on Explorer",
      signedSuccess: "Signed successfully",
      signaturesProgress: (args: any) => `Signatures: ${args?.signed}/${args?.required}`,
    };
    const tmpl = translations[key] ?? key;
    return typeof tmpl === "function" ? tmpl(args) : tmpl;
  },
  useLocale: () => "en",
}));

// Mock ToastProvider hook
jest.mock("../../components/ToastProvider", () => ({
  useToast: () => ({
    showError: jest.fn(),
    showSuccess: jest.fn(),
  }),
}));

// Mock write guard
jest.mock("../../hooks/useWriteGuard", () => ({
  useWriteGuard: () => ({
    invoke: jest.fn(async (_: string, __: string, fn: any) => fn()),
    isPending: () => false,
  }),
}));

// Mock the multi-sig hook
jest.mock("../../hooks/useMultiSigProposals");

describe("MultiSigWithdrawalPanel component", () => {
  const campaign = {
    id: "camp1",
    creator: "GABCDE12345",
    is_cancelled: false,
    funds_withdrawn: false,
    amount_raised: 10000000,
    funding_goal: 5000000,
  } as any;
  const creatorWallet = "GABCDE12345";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("pending-approval state shows enabled Sign button", () => {
    (useMultiSigProposals as jest.Mock).mockReturnValue({
      activeProposal: {
        id: "prop1",
        status: "pending",
        requiredSignatures: 2,
        signers: [
          { address: creatorWallet, signedAt: null },
          { address: "GSigner2", signedAt: null },
        ],
      },
      createProposal: jest.fn(),
      signProposal: jest.fn(),
      cancelProposal: jest.fn(),
      markExecuted: jest.fn(),
    });

    render(
      <MultiSigWithdrawalPanel
        campaign={campaign}
        walletAddress={creatorWallet}
        platformFeeBps={300}
      />,
    );

    const signBtn = screen.getByText("Sign Proposal");
    expect(signBtn).toBeInTheDocument();
    expect(signBtn).toBeEnabled();
  });

  test("fully-approved state shows Execute button for creator", () => {
    (useMultiSigProposals as jest.Mock).mockReturnValue({
      activeProposal: {
        id: "prop2",
        status: "ready",
        requiredSignatures: 2,
        signers: [
          { address: "GSigner1", signedAt: 1 },
          { address: "GSigner2", signedAt: 2 },
        ],
      },
      createProposal: jest.fn(),
      signProposal: jest.fn(),
      cancelProposal: jest.fn(),
      markExecuted: jest.fn(),
    });

    render(
      <MultiSigWithdrawalPanel
        campaign={campaign}
        walletAddress={creatorWallet}
        platformFeeBps={300}
      />,
    );

    const execBtn = screen.getByText(/Execute Withdrawal/);
    expect(execBtn).toBeInTheDocument();
    expect(execBtn).toBeEnabled();
  });

  test("sign button hidden when wallet already signed", () => {
    const signerWallet = "GSigner1";
    (useMultiSigProposals as jest.Mock).mockReturnValue({
      activeProposal: {
        id: "prop3",
        status: "pending",
        requiredSignatures: 2,
        signers: [
          { address: signerWallet, signedAt: 1 },
          { address: "GSigner2", signedAt: null },
        ],
      },
      createProposal: jest.fn(),
      signProposal: jest.fn(),
      cancelProposal: jest.fn(),
      markExecuted: jest.fn(),
    });

    render(
      <MultiSigWithdrawalPanel
        campaign={campaign}
        walletAddress={signerWallet}
        platformFeeBps={300}
      />,
    );

    const signBtn = screen.queryByText("Sign Proposal");
    expect(signBtn).toBeNull();
  });
});
