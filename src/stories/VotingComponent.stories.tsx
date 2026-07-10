import type { Meta, StoryObj } from "@storybook/react";
import VotingComponent from "../components/VotingComponent";
import { Category } from "../types";

const baseCampaign = {
  id: 1,
  creator: "GABC123456789012345678901234567890123456789012345678901234",
  title: "Clean Water for Rural Communities",
  description: "Providing clean water access to 500 families.",
  created_at: Math.floor(Date.now() / 1000) - 86400 * 5,
  status: "active" as const,
  funding_goal: BigInt(100_000_000_000),
  deadline: Math.floor(Date.now() / 1000) + 86400 * 30,
  amount_raised: BigInt(65_000_000_000),
  is_active: true,
  funds_withdrawn: false,
  is_cancelled: false,
  is_verified: false,
  category: Category.Learner,
  has_revenue_sharing: false,
  revenue_share_percentage: 0,
};

const meta: Meta<typeof VotingComponent> = {
  title: "UI/VotingComponent",
  component: VotingComponent,
  tags: ["autodocs"],
  args: {
    campaign: baseCampaign,
    userWalletAddress: null,
    onVote: async () => {},
    isVoting: false,
    upvotes: 42,
    downvotes: 8,
    totalVotes: 50,
    minVotesQuorum: 10,
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof VotingComponent>;

export const NotConnected: Story = {};

export const Connected: Story = {
  args: {
    userWalletAddress: "GDEF123456789012345678901234567890123456789012345678901234",
  },
};

export const AlreadyVotedUp: Story = {
  args: {
    userWalletAddress: "GDEF123456789012345678901234567890123456789012345678901234",
    userVote: {
      causeId: "1",
      voter: "GDEF123456789012345678901234567890123456789012345678901234",
      voteType: "upvote",
      timestamp: new Date(),
      transactionHash: "abc123",
    },
  },
};

export const Voting: Story = {
  args: {
    userWalletAddress: "GDEF123456789012345678901234567890123456789012345678901234",
    isVoting: true,
  },
};

export const HighEngagement: Story = {
  args: {
    upvotes: 980,
    downvotes: 20,
    totalVotes: 1000,
  },
};
