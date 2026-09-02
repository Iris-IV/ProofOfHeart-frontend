import type { Meta, StoryObj } from "@storybook/react";
import DeadlineCountdown from "../components/DeadlineCountdown";

const NOW = Math.floor(Date.now() / 1000);

const meta: Meta<typeof DeadlineCountdown> = {
  title: "UI/DeadlineCountdown",
  component: DeadlineCountdown,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof DeadlineCountdown>;

export const ThirtyDays: Story = {
  args: { deadline: NOW + 86400 * 30 },
};

export const TwelveHours: Story = {
  args: { deadline: NOW + 3600 * 12 },
};

export const FifteenMinutes: Story = {
  args: { deadline: NOW + 60 * 15 },
};

export const Expired: Story = {
  args: { deadline: NOW - 3600 },
};
