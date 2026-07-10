import type { Meta, StoryObj } from "@storybook/react";
import {
  CauseCardSkeleton,
  CampaignRowSkeleton,
  CauseDetailSkeleton,
  DashboardSkeleton,
  AdminSkeleton,
  Spinner,
  PageSpinner,
} from "../components/Skeleton";

const meta: Meta = {
  title: "UI/Skeletons",
  tags: ["autodocs"],
};

export default meta;

export const SkeletonCard: StoryObj = {
  render: () => (
    <div className="max-w-sm">
      <CauseCardSkeleton />
    </div>
  ),
};

export const SkeletonGrid: StoryObj = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl">
      <CauseCardSkeleton />
      <CauseCardSkeleton />
      <CauseCardSkeleton />
    </div>
  ),
};

export const CampaignRow: StoryObj = {
  render: () => (
    <div className="max-w-2xl space-y-2">
      <CampaignRowSkeleton />
      <CampaignRowSkeleton />
    </div>
  ),
};

export const CauseDetail: StoryObj = {
  render: () => <CauseDetailSkeleton />,
};

export const Dashboard: StoryObj = {
  render: () => <DashboardSkeleton />,
};

export const Admin: StoryObj = {
  render: () => <AdminSkeleton />,
};

export const LoadingSpinner: StoryObj = {
  render: () => (
    <div className="flex gap-4 items-center">
      <Spinner className="h-4 w-4 text-blue-500" />
      <Spinner className="h-8 w-8 text-green-500" />
      <Spinner className="h-12 w-12 text-red-500" />
    </div>
  ),
};

export const FullPageSpinner: StoryObj = {
  render: () => (
    <div className="h-64 relative">
      <PageSpinner />
    </div>
  ),
};
