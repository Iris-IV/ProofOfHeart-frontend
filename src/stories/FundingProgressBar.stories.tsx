import type { Meta, StoryObj } from "@storybook/react";
import FundingProgressBar from "../components/FundingProgressBar";

const meta: Meta<typeof FundingProgressBar> = {
  title: "UI/FundingProgressBar",
  component: FundingProgressBar,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof FundingProgressBar>;

const GOAL = BigInt(100_000_000_000);

export const Empty: Story = {
  args: {
    amountRaised: BigInt(0),
    fundingGoal: GOAL,
  },
};

export const HalfFunded: Story = {
  args: {
    amountRaised: BigInt(50_000_000_000),
    fundingGoal: GOAL,
  },
};

export const FullyFunded: Story = {
  args: {
    amountRaised: GOAL,
    fundingGoal: GOAL,
  },
};

export const WithMilestones: Story = {
  args: {
    amountRaised: BigInt(55_000_000_000),
    fundingGoal: GOAL,
    milestones: [
      { targetAmount: BigInt(25_000_000_000), description: "First 100 families" },
      { targetAmount: BigInt(50_000_000_000), description: "Next 200 families" },
      { targetAmount: BigInt(75_000_000_000), description: "Final 200 families" },
    ],
  },
};
