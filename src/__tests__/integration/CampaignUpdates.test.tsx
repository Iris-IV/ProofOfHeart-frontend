import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ToastProvider } from '@/components/ToastProvider';
import UpdatesSection from '@/components/UpdatesSection';
import { WalletProvider } from '@/components/WalletContext';
import * as campaignUpdatesModule from '@/lib/campaignUpdates';
import { Campaign, Category } from '@/types';

// Mock the campaign updates module
jest.mock('@/lib/campaignUpdates', () => ({
  getCampaignUpdates: jest.fn(),
  createCampaignUpdate: jest.fn(),
}));

const mockGetCampaignUpdates = campaignUpdatesModule.getCampaignUpdates as jest.Mock;
const mockCreateCampaignUpdate = campaignUpdatesModule.createCampaignUpdate as jest.Mock;

const mockCampaign: Campaign = {
  id: 1,
  creator: 'GCREATOR12345678901234567890123456789012345678901234567890',
  title: 'Test Campaign',
  description: 'Test Description',
  created_at: Math.floor(Date.now() / 1000) - 86400,
  status: 'active',
  funding_goal: BigInt(100000000000),
  deadline: Math.floor(Date.now() / 1000) + 86400 * 30,
  amount_raised: BigInt(50000000000),
  is_active: true,
  funds_withdrawn: false,
  is_cancelled: false,
  is_verified: false,
  category: Category.Learner,
  has_revenue_sharing: false,
  revenue_share_percentage: 0,
};

const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
};

const renderUpdatesSection = (
  campaign: Campaign,
  walletPublicKey: string | null = null
) => {
  const queryClient = createTestQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <WalletProvider>
          <UpdatesSection campaign={campaign} />
        </WalletProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
};

describe('UpdatesSection Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('Viewing updates', () => {
    it('renders updates in reverse chronological order', async () => {
      const mockUpdates = [
        {
          id: 'update-2',
          campaignId: 1,
          content: 'Newer update',
          authorAddress: mockCampaign.creator,
          timestamp: Math.floor(Date.now() / 1000) - 3600,
          signature: 'sig-2',
        },
        {
          id: 'update-1',
          campaignId: 1,
          content: 'Older update',
          authorAddress: mockCampaign.creator,
          timestamp: Math.floor(Date.now() / 1000) - 86400,
          signature: 'sig-1',
        },
      ];

      mockGetCampaignUpdates.mockResolvedValue(mockUpdates);

      renderUpdatesSection(mockCampaign);

      await waitFor(() => {
        expect(screen.getByText('Newer update')).toBeInTheDocument();
        expect(screen.getByText('Older update')).toBeInTheDocument();
      });

      // Verify order - newer should appear first
      const articles = screen.getAllByRole('article');
      expect(articles[0]).toHaveTextContent('Newer update');
      expect(articles[1]).toHaveTextContent('Older update');
    });

    it('shows empty state when no updates exist', async () => {
      mockGetCampaignUpdates.mockResolvedValue([]);

      renderUpdatesSection(mockCampaign);

      await waitFor(() => {
        expect(screen.getByText('No updates yet')).toBeInTheDocument();
      });
    });

    it('shows loading state initially', () => {
      mockGetCampaignUpdates.mockReturnValue(
        new Promise(() => {}) // Never resolves
      );

      renderUpdatesSection(mockCampaign);

      expect(screen.getAllByTestId('skeleton')).toHaveLength(9);
    });

    it('shows error state on fetch failure', async () => {
      mockGetCampaignUpdates.mockRejectedValue(new Error('Failed to fetch'));

      renderUpdatesSection(mockCampaign);

      await waitFor(() => {
        expect(
          screen.getByText(/⚠️ Failed to load updates/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Creator-only composer', () => {
    it('shows composer when user is the campaign creator', async () => {
      // Set wallet to creator address
      localStorage.setItem('stellar_wallet_public_key', mockCampaign.creator);
      mockGetCampaignUpdates.mockResolvedValue([]);

      renderUpdatesSection(mockCampaign, mockCampaign.creator);

      await waitFor(() => {
        expect(screen.getByText('✏️ Write an update')).toBeInTheDocument();
      });
    });

    it('hides composer when user is not the campaign creator', async () => {
      // Set wallet to different address
      const otherAddress = 'GOTHER12345678901234567890123456789012345678901234567890';
      localStorage.setItem('stellar_wallet_public_key', otherAddress);
      mockGetCampaignUpdates.mockResolvedValue([]);

      renderUpdatesSection(mockCampaign, otherAddress);

      await waitFor(() => {
        expect(screen.queryByText('✏️ Write an update')).not.toBeInTheDocument();
      });
    });

    it('hides composer when wallet is not connected', async () => {
      mockGetCampaignUpdates.mockResolvedValue([]);

      renderUpdatesSection(mockCampaign, null);

      await waitFor(() => {
        expect(screen.queryByText('✏️ Write an update')).not.toBeInTheDocument();
      });
    });
  });

  describe('Creating updates', () => {
    it('allows creator to post a new update', async () => {
      localStorage.setItem('stellar_wallet_public_key', mockCampaign.creator);
      mockGetCampaignUpdates.mockResolvedValue([]);
      mockCreateCampaignUpdate.mockResolvedValue({
        id: 'new-update',
        campaignId: 1,
        content: 'New update content',
        authorAddress: mockCampaign.creator,
        timestamp: Math.floor(Date.now() / 1000),
        signature: 'new-sig',
      });

      renderUpdatesSection(mockCampaign, mockCampaign.creator);

      // Open composer
      await waitFor(() => {
        expect(screen.getByText('✏️ Write an update')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('✏️ Write an update'));

      // Type content
      const textarea = screen.getByPlaceholderText(
        /Share progress, milestones, or news with your supporters/i
      );
      fireEvent.change(textarea, {
        target: { value: 'New update content' },
      });

      // Submit
      fireEvent.click(screen.getByText('Post Update'));

      await waitFor(() => {
        expect(mockCreateCampaignUpdate).toHaveBeenCalledWith(
          1,
          'New update content',
          mockCampaign.creator
        );
      });
    });

    it('shows submitting state while creating update', async () => {
      localStorage.setItem('stellar_wallet_public_key', mockCampaign.creator);
      mockGetCampaignUpdates.mockResolvedValue([]);
      mockCreateCampaignUpdate.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      renderUpdatesSection(mockCampaign, mockCampaign.creator);

      await waitFor(() => {
        expect(screen.getByText('✏️ Write an update')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('✏️ Write an update'));

      const textarea = screen.getByPlaceholderText(
        /Share progress, milestones, or news with your supporters/i
      );
      fireEvent.change(textarea, {
        target: { value: 'Update content' },
      });

      fireEvent.click(screen.getByText('Post Update'));

      expect(screen.getByText('Posting...')).toBeInTheDocument();
    });

    it('shows error toast on submission failure', async () => {
      localStorage.setItem('stellar_wallet_public_key', mockCampaign.creator);
      mockGetCampaignUpdates.mockResolvedValue([]);
      mockCreateCampaignUpdate.mockRejectedValue(new Error('Submission failed'));

      renderUpdatesSection(mockCampaign, mockCampaign.creator);

      await waitFor(() => {
        expect(screen.getByText('✏️ Write an update')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('✏️ Write an update'));

      const textarea = screen.getByPlaceholderText(
        /Share progress, milestones, or news with your supporters/i
      );
      fireEvent.change(textarea, {
        target: { value: 'Update content' },
      });

      fireEvent.click(screen.getByText('Post Update'));

      await waitFor(() => {
        expect(screen.getByText(/Submission failed/i)).toBeInTheDocument();
      });
    });

    it('clears composer after successful submission', async () => {
      localStorage.setItem('stellar_wallet_public_key', mockCampaign.creator);
      mockGetCampaignUpdates.mockResolvedValue([]);
      mockCreateCampaignUpdate.mockResolvedValue({
        id: 'new-update',
        campaignId: 1,
        content: 'Success!',
        authorAddress: mockCampaign.creator,
        timestamp: Math.floor(Date.now() / 1000),
        signature: 'sig',
      });

      renderUpdatesSection(mockCampaign, mockCampaign.creator);

      await waitFor(() => {
        expect(screen.getByText('✏️ Write an update')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('✏️ Write an update'));

      const textarea = screen.getByPlaceholderText(
        /Share progress, milestones, or news with your supporters/i
      );
      fireEvent.change(textarea, {
        target: { value: 'Success update' },
      });

      fireEvent.click(screen.getByText('Post Update'));

      // After success, composer should collapse
      await waitFor(() => {
        expect(screen.getByText('✏️ Write an update')).toBeInTheDocument();
      });
    });
  });

  describe('UI/UX requirements', () => {
    it('displays update count when updates exist', async () => {
      const mockUpdates = [
        {
          id: 'update-1',
          campaignId: 1,
          content: 'Update 1',
          authorAddress: mockCampaign.creator,
          timestamp: Math.floor(Date.now() / 1000),
          signature: 'sig',
        },
        {
          id: 'update-2',
          campaignId: 1,
          content: 'Update 2',
          authorAddress: mockCampaign.creator,
          timestamp: Math.floor(Date.now() / 1000),
          signature: 'sig',
        },
      ];

      mockGetCampaignUpdates.mockResolvedValue(mockUpdates);

      renderUpdatesSection(mockCampaign);

      await waitFor(() => {
        expect(screen.getByText('2 updates')).toBeInTheDocument();
      });
    });

    it('displays singular "update" when only one exists', async () => {
      const mockUpdates = [
        {
          id: 'update-1',
          campaignId: 1,
          content: 'Single update',
          authorAddress: mockCampaign.creator,
          timestamp: Math.floor(Date.now() / 1000),
          signature: 'sig',
        },
      ];

      mockGetCampaignUpdates.mockResolvedValue(mockUpdates);

      renderUpdatesSection(mockCampaign);

      await waitFor(() => {
        expect(screen.getByText('1 update')).toBeInTheDocument();
      });
    });

    it('has proper section heading', async () => {
      mockGetCampaignUpdates.mockResolvedValue([]);

      renderUpdatesSection(mockCampaign);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Updates' })).toBeInTheDocument();
      });
    });
  });
});
