import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import DonationModal from "../components/DonationModal";
import { Category } from "../types";

const NOW = Math.floor(Date.now() / 1000);

const activeCampaign = {
  id: 1,
  creator: "GABC123456789012345678901234567890123456789012345678901234",
  title: "Clean Water for Rural Communities",
  description: "Providing clean water access to 500 families in rural areas.",
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
};

const meta: Meta<typeof DonationModal> = {
  title: "UI/DonationModal",
  component: DonationModal,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof DonationModal>;

function ModalWrapper(props: React.ComponentProps<typeof DonationModal>) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
      >
        Open Donation Modal
      </button>
      <DonationModal {...props} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

export const Default: Story = {
  render: (args) => <ModalWrapper {...args} />,
  args: {
    campaign: activeCampaign,
    isOpen: true,
    onClose: () => {},
    onDonationSuccess: () => {},
  },
};

export const WithRevenueSharing: Story = {
  render: (args) => <ModalWrapper {...args} />,
  args: {
    campaign: {
      ...activeCampaign,
      has_revenue_sharing: true,
      revenue_share_percentage: 300,
      category: Category.EducationalStartup,
    },
    isOpen: true,
    onClose: () => {},
    onDonationSuccess: () => {},
  },
};
