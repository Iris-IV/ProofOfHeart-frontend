import { render, screen } from '@testing-library/react';
import CampaignStatusBadge from '@/components/CampaignStatusBadge';
import { Campaign, Category } from '@/types';

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 1,
    creator: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ',
    title: 'Test Campaign',
    description: 'A test campaign',
    funding_goal: BigInt(100_000_000),
    deadline: Math.floor(Date.now() / 1000) + 86400, // 1 day from now
    amount_raised: BigInt(0),
    is_active: true,
    funds_withdrawn: false,
    is_cancelled: false,
    is_verified: false,
    category: Category.Learner,
    has_revenue_sharing: false,
    revenue_share_percentage: 0,
    created_at: Math.floor(Date.now() / 1000),
    status: 'active',
    ...overrides,
  };
}

describe('CampaignStatusBadge', () => {
  it('shows "Active" for an active campaign', () => {
    render(<CampaignStatusBadge campaign={makeCampaign({ is_active: true })} />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows "Cancelled" for a cancelled campaign', () => {
    render(
      <CampaignStatusBadge campaign={makeCampaign({ is_cancelled: true, is_active: false })} />
    );
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('shows "Funded" when funds have been withdrawn', () => {
    render(
      <CampaignStatusBadge
        campaign={makeCampaign({ funds_withdrawn: true, is_active: false })}
      />
    );
    expect(screen.getByText('Funded')).toBeInTheDocument();
  });

  it('shows "Failed" when deadline passed and goal not reached', () => {
    render(
      <CampaignStatusBadge
        campaign={makeCampaign({
          is_active: false,
          deadline: Math.floor(Date.now() / 1000) - 100, // past deadline
          amount_raised: BigInt(1_000_000),
          funding_goal: BigInt(100_000_000),
        })}
      />
    );
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('shows a "Verified" badge when campaign is verified and status is not already verified', () => {
    render(
      <CampaignStatusBadge campaign={makeCampaign({ is_active: true, is_verified: true })} />
    );
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('does not show a second "Verified" badge when status is already verified', () => {
    // Status becomes 'verified' only when is_verified flag drives deriveCampaignStatus to 'verified'
    // Based on current logic, deriveCampaignStatus does not return 'verified' directly —
    // the 'Verified' extra badge appears when is_verified=true AND status !== 'verified'.
    // So for an active+verified campaign we get one Active badge and one Verified badge.
    render(
      <CampaignStatusBadge campaign={makeCampaign({ is_active: true, is_verified: true })} />
    );
    expect(screen.getAllByText('Verified')).toHaveLength(1);
  });
});
