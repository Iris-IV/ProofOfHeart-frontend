import type { Meta, StoryObj } from "@storybook/react";
import ShareButtons from "../components/ShareButtons";

const meta: Meta<typeof ShareButtons> = {
  title: "UI/ShareButtons",
  component: ShareButtons,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="p-6 bg-white dark:bg-zinc-900 rounded-xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ShareButtons>;

export const Default: Story = {
  args: {
    url: "https://proofofheart.org/causes/1",
    title: "Clean Water for Rural Communities",
  },
};

export const LongTitle: Story = {
  args: {
    url: "https://proofofheart.org/causes/42",
    title: "Education Technology for Underprivileged Children in Remote Areas",
  },
};

export const NoUrl: Story = {
  args: {
    url: undefined,
    title: "Campaign without a URL",
  },
};
