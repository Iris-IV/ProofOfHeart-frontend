import type { Meta, StoryObj } from "@storybook/react";
import CauseCard from "../components/CauseCard";
import { Category } from "../types";

const NOW = Math.floor(Date.now() / 1000);

const baseCampaign = {
  id: 1,
  creator: "GABC123456789012345678901234567890123456789012345678901234",
  title: "Clean Water for Rural Communities",
  description:
    "Providing clean water access to 500 families in rural areas affected by drought. Your contribution helps bring safe, clean water directly to households that need it most.",
  created_at: NOW - 86400 * 5,
  status: "active" as const,
  funding_goal: BigInt(100_000_000_000),
  deadline: NOW + 86400 * 30,
  amount_raised: BigInt(65_000_000_000),
  is_active: true,
  funds_withdrawn: false,
  is_cancelled: false,
  is_verified: true,
  category: Category.Learner,
  has_revenue_sharing: false,
  revenue_share_percentage: 0,
  tags: ["water", "rural", "health"],
  milestones: [
    { targetAmount: BigInt(25_000_000_000), description: "First 100 families connected" },
    { targetAmount: BigInt(75_000_000_000), description: "Final 200 families connected" },
  ],
};

const meta: Meta<typeof CauseCard> = {
  title: "UI/CauseCard",
  component: CauseCard,
  tags: ["autodocs"],
  args: {
    campaign: baseCampaign,
    userWalletAddress: null,
    onVote: async () => {},
    onCancel: async () => {},
    onClaimRefund: async () => {},
    onTagClick: () => {},
    upvotes: 42,
    downvotes: 8,
    totalVotes: 50,
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CauseCard>;

export const Active: Story = {};

export const Verified: Story = {
  args: { campaign: { ...baseCampaign, is_verified: true } },
};

export const FullyFunded: Story = {
  args: {
    campaign: {
      ...baseCampaign,
      amount_raised: BigInt(100_000_000_000),
      is_active: false,
      funds_withdrawn: false,
      status: "funded" as const,
    },
  },
};

export const Cancelled: Story = {
  args: {
    campaign: {
      ...baseCampaign,
      is_cancelled: true,
      status: "cancelled" as const,
    },
  },
};

export const Failed: Story = {
  args: {
    campaign: {
      ...baseCampaign,
      deadline: NOW - 86400 * 3,
      is_active: false,
      amount_raised: BigInt(20_000_000_000),
      status: "failed" as const,
    },
  },
};

export const WalletConnected: Story = {
  args: {
    userWalletAddress: "GDEF123456789012345678901234567890123456789012345678901234",
  },
};

export const UserIsCreator: Story = {
  args: {
    userWalletAddress: baseCampaign.creator,
  },
};

export const WithRevenuSharing: Story = {
  args: {
    campaign: {
      ...baseCampaign,
      has_revenue_sharing: true,
      revenue_share_percentage: 300,
      category: Category.EducationalStartup,
    },
  },
};
